import { useRef, useState } from "react";
import {
  api,
  clearExamCache,
  mapExam,
  mapExamAttempt,
  readExamCache,
} from "../lib/study";
import { persistExamProgress, preloadExamAssets, questionsForRunSection } from "../lib/appHelpers";

/** Exam run lifecycle: loading, answering (with queued server saves), section transitions, submit and review. */
export function useExamFlow({ navigate, authToken, currentUser, exams, level, refreshStudyData, setExamRuns, setError, onLeave }) {
  const [examSession, setExamSession] = useState<any>(null);
  const [examStarting, setExamStarting] = useState(false);
  const [examSectionStarting, setExamSectionStarting] = useState(false);
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [examSaveState, setExamSaveState] = useState("idle");
  const examSaveQueue = useRef(Promise.resolve());
  const examSaveFailures = useRef(new Set());
  const examSaveVersion = useRef(0);

  async function loadExam(examId, baseExam = null) {
    setError("");
    const numericExamId = Number(examId);
    const cached = readExamCache(currentUser.id, numericExamId);
    if (!cached.runId) {
      // 提交完成后缓存已清；若内存里已是本科的回顾态（提交后 ExamRoute effect 会再次触发 loadExam），应回到回顾页而非说明页。
      if (examSession?.finishedAttempt && examSession?.exam?.id === numericExamId) {
        navigate(`/exams/${numericExamId}/review/${examSession.reviewAttemptId}`, { replace: true });
        return;
      }
      navigate(`/exams/${numericExamId}/start`, { replace: true });
      return;
    }
    const [detail, allQuestions, run] = await Promise.all([
      api(`/api/exams/${numericExamId}`, {}, authToken),
      api(`/api/exams/${numericExamId}/questions`, {}, authToken),
      api(`/api/exam-runs/${cached.runId}`, {}, authToken),
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
    setExamRuns((rows) => rows.filter((item) => item.id !== run.id));
  }

  async function loadExamIntro(examId) {
    const detail = await api(`/api/exams/${Number(examId)}`, {}, authToken);
    setExamSession({ exam: { ...mapExam(detail), layers: detail.layers || [] }, phase: "intro" });
  }

  async function beginExam() {
    if (examStarting) return;
    setExamStarting(true);
    const exam = examSession.exam;
    try {
      const [detail, allQuestions] = await Promise.all([
        api(`/api/exams/${exam.id}`, {}, authToken),
        api(`/api/exams/${exam.id}/questions`, {}, authToken),
      ]);
      await preloadExamAssets(allQuestions);
      const run = await api(`/api/exam-runs?exam_id=${exam.id}`, { method: "POST" }, authToken);
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
    const [detail, questions, attemptDetail] = await Promise.all([
      api(`/api/exams/${numericExamId}`, {}, authToken),
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
        }),
      }, authToken),
    );
    await refreshStudyData(level, authToken);
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
        await refreshStudyData(level, authToken);
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
    onLeave();
  }


  return {
    examSession, setExamSession, examStarting, examSectionStarting, examSubmitting, examSaveState,
    loadExam, startExam, resumeExam, abandonExam, loadExamIntro, beginExam, reviewExamAttempt, loadExamReview,
    chooseExamOption, retryExamSave, moveExamQuestion, submitExam, startNextExamSection, leaveActiveExam,
  };
}
