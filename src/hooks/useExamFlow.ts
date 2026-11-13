import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  api,
  clearExamCache,
  mapExam,
  mapExamAttempt,
  readExamCache,
} from "../lib/study";
import { persistExamProgress, preloadExamAssets, questionsForRunSection } from "../lib/appHelpers";
import { sessionDurationSeconds } from "../lib/stats";
import { useAuthStore } from "../stores/auth";
import { useExamSessionStore } from "../stores/examSession";
import { usePreferencesStore } from "../stores/preferences";
import { useQuizSessionStore } from "../stores/quizSession";
import { useExams } from "./useLibraryData";

/** Exam run lifecycle: loading, answering (with queued server saves), section transitions, submit and review.
 *  T-022 刀一：会话与保存状态存于 useExamSessionStore，本 hook 退化为 actions 层。
 *  T-023 S3：零入参——自取 navigate / store 状态 / exams Query 缓存，ExamListView 与路由守卫各自调用
 *  （队列 ref 属挂载实例，同一时刻单路由挂载，语义不变）。
 *  模考域拉取（exam detail / questions / run / runs 列表）经 Query 缓存（fetchQuery，去重 + 短 staleTime）；
 *  进行中 run 的恢复依据改为服务端（GET /api/exam-runs），localStorage 考试缓存降级为 index/answers 加速缓存。 */
export function useExamFlow() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authToken = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.currentUser);
  const level = usePreferencesStore((state) => state.level);
  const setError = usePreferencesStore((state) => state.setError);
  const examsQuery = useExams(level, authToken, currentUser?.id);
  const exams = examsQuery.data || [];
  const examSession = useExamSessionStore((state) => state.examSession);
  const examStarting = useExamSessionStore((state) => state.examStarting);
  const examSectionStarting = useExamSessionStore((state) => state.examSectionStarting);
  const examSubmitting = useExamSessionStore((state) => state.examSubmitting);
  const examSaveState = useExamSessionStore((state) => state.examSaveState);
  const setExamSession = useExamSessionStore((state) => state.setExamSession);
  const setExamStarting = useExamSessionStore((state) => state.setExamStarting);
  const setExamSectionStarting = useExamSessionStore((state) => state.setExamSectionStarting);
  const setExamSubmitting = useExamSessionStore((state) => state.setExamSubmitting);
  const setExamSaveState = useExamSessionStore((state) => state.setExamSaveState);
  const examSaveQueue = useRef(Promise.resolve());
  const examSaveFailures = useRef(new Set());
  const examSaveVersion = useRef(0);

  function invalidateStudyData() {
    return queryClient.invalidateQueries({ queryKey: ["study-data", currentUser?.id, level] });
  }

  async function refreshStudyData() {
    await invalidateStudyData();
  }

  /** 退出到试卷列表：清空全部活动会话（原 App resetTo("/exams") 行为，quiz 会话一并清空）。 */
  function resetToExamList() {
    useQuizSessionStore.getState().setSelectedBook(null);
    useQuizSessionStore.getState().setQuizSession(null);
    setExamSession(null);
    navigate("/exams");
  }

  async function fetchExamDetail(examId) {
    return queryClient.fetchQuery({
      queryKey: ["exam-detail", examId],
      queryFn: () => api(`/api/exams/${examId}`, {}, authToken),
      staleTime: 60_000,
    });
  }

  async function fetchExamQuestions(examId) {
    return queryClient.fetchQuery({
      queryKey: ["exam-questions", examId],
      queryFn: () => api(`/api/exams/${examId}/questions`, {}, authToken),
      staleTime: 60_000,
    });
  }

  async function fetchExamRun(runId) {
    return queryClient.fetchQuery({
      queryKey: ["exam-run", runId],
      queryFn: () => api(`/api/exam-runs/${runId}`, {}, authToken),
      staleTime: 5_000,
    });
  }

  /** 服务端恢复依据：该 exam 当前进行中/待开始下一科的 run id（至多一个）。 */
  async function findActiveRunId(examId) {
    const runs = await queryClient.fetchQuery({
      queryKey: ["exam-runs"],
      queryFn: () => api("/api/exam-runs", {}, authToken),
      staleTime: 10_000,
    });
    const active = runs.find(
      (run) => run.exam_id === examId && ["in_progress", "awaiting_section"].includes(run.status),
    );
    return active?.id || null;
  }

  async function loadExam(examId, baseExam = null) {
    setError("");
    const numericExamId = Number(examId);
    // 提交完成后缓存已清；若内存里已是本科的回顾态（提交后 ExamRoute effect 会再次触发 loadExam），应回到回顾页而非说明页。
    if (examSession?.finishedAttempt && examSession?.exam?.id === numericExamId) {
      navigate(`/exams/${numericExamId}/review/${examSession.reviewAttemptId}`, { replace: true });
      return;
    }
    // 恢复依据：服务端 active run 优先；localStorage 缓存的 runId 兜底（runId/index/answers 均为可丢弃加速缓存）
    const cached = readExamCache(currentUser.id, numericExamId);
    const runId = (await findActiveRunId(numericExamId)) || cached.runId || null;
    if (!runId) {
      navigate(`/exams/${numericExamId}/start`, { replace: true });
      return;
    }
    const [detail, allQuestions, run] = await Promise.all([
      fetchExamDetail(numericExamId),
      fetchExamQuestions(numericExamId),
      fetchExamRun(runId),
    ]);
    const exam = baseExam || exams.find((item) => item.id === numericExamId) || mapExam(detail);
    const questions = questionsForRunSection(allQuestions, run);
    const cachedIndex = Number.isInteger(cached.index) ? cached.index : 0;
    const restored = {
      exam: { ...exam, layers: detail.layers || [] },
      run,
      allQuestions,
      questions,
      index: Math.max(0, Math.min(questions.length - 1, cachedIndex)),
      answers: { ...(cached.answers || {}), ...(run.answers || {}) },
      finishedAttempt: null,
      // T-014：计时起点（run 路径时长由服务端计算，此值只兜底无 run 会话）
      startedAt: cached.updatedAt || new Date().toISOString(),
    };
    if (run.status === "completed") {
      clearExamCache(currentUser.id, numericExamId);
      await loadExamReview(numericExamId, run.attempt_id);
      navigate(`/exams/${numericExamId}/review/${run.attempt_id}`, { replace: true });
      return;
    }
    setExamSession(restored);
  }

  async function startExam(exam) {
    setExamSession({ exam, phase: "intro" });
    navigate(`/exams/${exam.id}/start`);
  }

  function resumeExam(exam, run) {
    persistExamProgress(currentUser.id, exam.id, run.id, 0, run.answers || {});
    setExamSession(null);
    navigate(`/exams/${exam.id}`);
  }

  async function abandonExam(exam, run) {
    if (!window.confirm(`确定放弃 ${exam.title}？已完成的答案不会生成成绩。`)) return;
    await api(`/api/exam-runs/${run.id}/abandon`, { method: "POST" }, authToken);
    clearExamCache(currentUser.id, exam.id);
    queryClient.invalidateQueries({ queryKey: ["exam-runs"] });
    invalidateStudyData();
  }

  async function loadExamIntro(examId) {
    const numericExamId = Number(examId);
    // 整页刷新后 store 已清空，误入 /start 无法靠内存会话拦截：
    // 服务端存在进行中 run 时不进说明页，直接走 loadExam 恢复（避免重复开卷）。
    const activeRunId = await findActiveRunId(numericExamId).catch(() => null);
    if (activeRunId) {
      await loadExam(numericExamId);
      return;
    }
    const detail = await fetchExamDetail(numericExamId);
    setExamSession({ exam: { ...mapExam(detail), layers: detail.layers || [] }, phase: "intro" });
  }

  async function beginExam() {
    if (examStarting) return;
    setExamStarting(true);
    const exam = examSession.exam;
    try {
      const [detail, allQuestions] = await Promise.all([
        fetchExamDetail(exam.id),
        fetchExamQuestions(exam.id),
      ]);
      await preloadExamAssets(allQuestions);
      const run = await api(`/api/exam-runs?exam_id=${exam.id}`, { method: "POST" }, authToken);
      queryClient.invalidateQueries({ queryKey: ["exam-runs"] });
      const cached = readExamCache(currentUser.id, exam.id);
      const next = {
        exam: { ...exam, layers: detail.layers || [] }, run, allQuestions,
        questions: questionsForRunSection(allQuestions, run),
        index: 0, answers: { ...(cached.answers || {}), ...(run.answers || {}) }, finishedAttempt: null,
      };
      persistExamProgress(currentUser.id, exam.id, run.id, 0, next.answers);
      setExamSaveState("saved");
      examSaveFailures.current.clear();
      setExamSession(next);
      navigate(`/exams/${exam.id}`);
    } finally {
      setExamStarting(false);
    }
  }

  async function reviewExamAttempt(attempt) {
    await loadExamReview(attempt.examId, attempt.id, attempt);
    navigate(`/exams/${attempt.examId}/review/${attempt.id}`);
  }

  async function loadExamReview(examId, attemptId, baseAttempt = null) {
    setError("");
    const numericExamId = Number(examId);
    const numericAttemptId = Number(attemptId);
    // 回顾内容随重考变化，不缓存（仅 exam detail 走 Query 缓存）
    const [detail, questions, attemptDetail] = await Promise.all([
      fetchExamDetail(numericExamId),
      api(`/api/exam-attempts/${numericAttemptId}/questions`, {}, authToken),
      api(`/api/exam-attempts/${numericAttemptId}`, {}, authToken),
    ]);
    const baseExam = exams.find((exam) => exam.id === numericExamId) || mapExam(detail);
    const finishedAttempt = mapExamAttempt(attemptDetail);
    setExamSession({
      exam: { ...baseExam, layers: detail.layers || [] },
      questions,
      index: 0,
      answers: {},
      finishedAttempt,
      reviewAttemptId: baseAttempt?.id || finishedAttempt.id,
    });
  }

  function chooseExamOption(questionId, optionId) {
    setExamSession((current) => {
      const next = {
        ...current,
        answers: { ...current.answers, [questionId]: optionId },
      };
      persistExamProgress(currentUser.id, next.exam.id, next.run?.id, next.index, next.answers);
      return next;
    });
    if (examSession?.run) {
      const version = ++examSaveVersion.current;
      setExamSaveState("saving");
      examSaveQueue.current = examSaveQueue.current.then(async () => {
        try {
          const run = await api(`/api/exam-runs/${examSession.run.id}/answers/${questionId}`, {
            method: "PUT",
            body: JSON.stringify({ chosen_option_id: optionId }),
          }, authToken);
          examSaveFailures.current.delete(questionId);
          setExamSession((current) => current ? ({ ...current, run }) : current);
          if (version === examSaveVersion.current && !examSaveFailures.current.size) setExamSaveState("saved");
        } catch (error) {
          examSaveFailures.current.add(questionId);
          setExamSaveState("error");
        }
      });
    }
  }

  async function retryExamSave() {
    if (!examSession?.run) return true;
    setExamSaveState("saving");
    try {
      let latestRun = examSession.run;
      for (const question of examSession.questions) {
        const optionId = examSession.answers[question.id];
        if (!optionId) continue;
        latestRun = await api(`/api/exam-runs/${examSession.run.id}/answers/${question.id}`, {
          method: "PUT",
          body: JSON.stringify({ chosen_option_id: optionId }),
        }, authToken);
      }
      examSaveFailures.current.clear();
      setExamSaveState("saved");
      setExamSession((current) => current ? ({ ...current, run: latestRun }) : current);
      return true;
    } catch (error) {
      setExamSaveState("error");
      return false;
    }
  }

  function moveExamQuestion(nextIndex) {
    setExamSession((current) => {
      const next = {
        ...current,
        index: Math.max(0, Math.min(current.questions.length - 1, nextIndex)),
      };
      persistExamProgress(currentUser.id, next.exam.id, next.run?.id, next.index, next.answers);
      return next;
    });
  }

  async function saveCompletedExam(current) {
    const saved = mapExamAttempt(
      await api("/api/exam-attempts", {
        method: "POST",
        body: JSON.stringify({
          exam_id: current.exam.id,
          answers: current.allQuestions.map((question) => ({
            question_id: question.id,
            chosen_option_id: current.answers[question.id] || null,
          })),
          // T-014：无 run 兜底路径用客户端时长；run 路径时长由服务端起止差决定，不带客户端值
          duration_seconds: sessionDurationSeconds(current.startedAt),
        }),
      }, authToken),
    );
    await refreshStudyData();
    clearExamCache(currentUser.id, current.exam.id);
    setExamSession((session) => ({ ...session, finishedAttempt: saved, reviewAttemptId: saved.id }));
    navigate(`/exams/${current.exam.id}/review/${saved.id}`);
  }

  async function submitExam(timedOut = false) {
    if (examSubmitting) return;
    if (!examSession?.run) return saveCompletedExam(examSession);
    const unanswered = examSession.questions.filter((question) => !examSession.answers[question.id]).length;
    const confirmMessage = unanswered
      ? `本科还有 ${unanswered} 题未作答。提交后将锁定答案，不能返回修改。确定提交吗？`
      : "本科题目已全部作答。提交后将锁定答案，不能返回修改。确定提交吗？";
    if (!timedOut && !window.confirm(confirmMessage)) return;
    setExamSubmitting(true);
    await examSaveQueue.current;
    try {
      if (examSaveFailures.current.size && !(await retryExamSave())) return;
      const run = await api(`/api/exam-runs/${examSession.run.id}/section/complete`, { method: "POST" }, authToken);
      if (run.status === "completed") {
        clearExamCache(currentUser.id, examSession.exam.id);
        await refreshStudyData();
        await loadExamReview(examSession.exam.id, run.attempt_id);
        navigate(`/exams/${examSession.exam.id}/review/${run.attempt_id}`);
        return;
      }
      const next = { ...examSession, run, questions: questionsForRunSection(examSession.allQuestions, run), index: 0 };
      persistExamProgress(currentUser.id, next.exam.id, run.id, 0, next.answers);
      setExamSession(next);
    } finally {
      setExamSubmitting(false);
    }
  }

  async function startNextExamSection() {
    if (examSectionStarting) return;
    setExamSectionStarting(true);
    try {
      await preloadExamAssets(examSession.questions);
      const run = await api(`/api/exam-runs/${examSession.run.id}/section/start`, { method: "POST" }, authToken);
      setExamSaveState("saved");
      setExamSession((current) => ({ ...current, run, index: 0 }));
    } finally {
      setExamSectionStarting(false);
    }
  }

  function leaveActiveExam() {
    if (examSession?.run?.status === "in_progress") {
      const confirmed = window.confirm("离开后考试不会暂停，倒计时仍会继续。确定返回试卷列表吗？");
      if (!confirmed) return;
    }
    resetToExamList();
  }


  return {
    examSession, setExamSession, examStarting, examSectionStarting, examSubmitting, examSaveState,
    loadExam, startExam, resumeExam, abandonExam, loadExamIntro, beginExam, reviewExamAttempt, loadExamReview,
    chooseExamOption, retryExamSave, moveExamQuestion, submitExam, startNextExamSection, leaveActiveExam, resetToExamList,
  };
}
