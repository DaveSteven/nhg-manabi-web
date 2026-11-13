import React, { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ExamIntroView, ExamResultView, ExamSectionBreakView, ExamSessionView } from "../pages";
import { useExamFlow } from "../hooks/useExamFlow";
import { useExamSessionStore } from "../stores/examSession";

// T-022 刀一 ①-3：路由守卫只读统一状态层（useExamSessionStore），不再接 App 内存 props
// （规则见 docs/develop/state-management.md 规则 3）。
// T-023 S3：动作回调同样不再由 App 传入——守卫直接调用 useExamFlow（actions 层）。

const Loading = ({ text }) => <div className="center-state">{text}</div>;

export function ExamRoute() {
  const numericExamId = Number(useParams().examId);
  const examSession = useExamSessionStore((state) => state.examSession);
  const saveState = useExamSessionStore((state) => state.examSaveState);
  const submitting = useExamSessionStore((state) => state.examSubmitting);
  const sectionStarting = useExamSessionStore((state) => state.examSectionStarting);
  const {
    loadExam, leaveActiveExam, chooseExamOption, moveExamQuestion, submitExam, startNextExamSection, retryExamSave,
  } = useExamFlow();

  useEffect(() => {
    if (!Number.isFinite(numericExamId)) return;
    if (examSession?.exam?.id === numericExamId && !examSession?.finishedAttempt) return;
    loadExam(numericExamId);
  }, [numericExamId, examSession?.exam?.id, examSession?.finishedAttempt]);

  if (!Number.isFinite(numericExamId)) return <Navigate to="/exams" replace />;
  if (!examSession || examSession.exam.id !== numericExamId) return <Loading text="正在加载试卷…" />;
  if (examSession.run?.status === "awaiting_section") {
    return <ExamSectionBreakView session={examSession} onStartNext={startNextExamSection} starting={sectionStarting} />;
  }
  if (!examSession.questions?.length) {
    return <div className="center-state error">当前科目没有可显示的题目。<button className="secondary-button" onClick={leaveActiveExam} type="button">返回试卷列表</button></div>;
  }
  return (
    <ExamSessionView
      session={examSession}
      onBack={leaveActiveExam}
      onChoose={chooseExamOption}
      onMove={moveExamQuestion}
      onSubmit={submitExam}
      saveState={saveState}
      onRetrySave={retryExamSave}
      submitting={submitting}
    />
  );
}

export function ExamIntroRoute() {
  const numericExamId = Number(useParams().examId);
  const examSession = useExamSessionStore((state) => state.examSession);
  const starting = useExamSessionStore((state) => state.examStarting);
  const { loadExamIntro, resetToExamList, beginExam } = useExamFlow();

  useEffect(() => {
    if (!Number.isFinite(numericExamId)) return;
    // 已处于 intro，或该科存在进行中/待开始的 run（beginExam 的 transition 提交间隙会短暂经过这里）时不重载，
    // 否则会把刚建立的考试会话抹掉；仅比较 exam id 则会让回顾态永远卡在 Loading。
    const forExam = examSession?.exam?.id === numericExamId;
    if (forExam && (examSession?.phase === "intro" || ["in_progress", "awaiting_section"].includes(examSession?.run?.status))) return;
    loadExamIntro(numericExamId);
  }, [numericExamId, examSession?.exam?.id, examSession?.phase, examSession?.run?.status]);
  if (!Number.isFinite(numericExamId)) return <Navigate to="/exams" replace />;
  // 考试进行中误入说明页（如浏览器后退）：回到会话页，避免永远停在 Loading。
  if (["in_progress", "awaiting_section"].includes(examSession?.run?.status) && examSession?.exam?.id === numericExamId) {
    return <Navigate to={`/exams/${numericExamId}`} replace />;
  }
  if (!examSession || examSession.exam.id !== numericExamId || examSession.phase !== "intro") return <Loading text="正在加载考试说明…" />;
  return <ExamIntroView exam={examSession.exam} onBack={resetToExamList} onStart={beginExam} starting={starting} />;
}

export function ExamReviewRoute() {
  const { examId, attemptId } = useParams();
  const numericExamId = Number(examId);
  const numericAttemptId = Number(attemptId);
  const examSession = useExamSessionStore((state) => state.examSession);
  const { loadExamReview, resetToExamList, startExam } = useExamFlow();
  const valid = Number.isFinite(numericExamId) && Number.isFinite(numericAttemptId);
  const loaded = Boolean(
    examSession?.exam?.id === numericExamId
    && examSession?.finishedAttempt
    && examSession?.reviewAttemptId === numericAttemptId,
  );

  useEffect(() => {
    if (valid && !loaded) loadExamReview(numericExamId, numericAttemptId);
  }, [numericExamId, numericAttemptId, examSession?.exam?.id, examSession?.reviewAttemptId]);

  if (!valid) return <Navigate to="/exams" replace />;
  if (!loaded) return <Loading text="正在加载复习内容…" />;
  return (
    <ExamResultView
      exam={examSession.exam}
      attempt={examSession.finishedAttempt}
      questions={examSession.questions}
      onRepeat={() => startExam(examSession.exam)}
      onLibrary={resetToExamList}
    />
  );
}
