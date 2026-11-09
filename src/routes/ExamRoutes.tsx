import React, { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ExamIntroView, ExamResultView, ExamSectionBreakView, ExamSessionView } from "../pages";

const Loading = ({ text }) => <div className="center-state">{text}</div>;

export function ExamRoute({ examSession, onLoadExam, onBack, onChoose, onMove, onSubmit, onStartNext, saveState, onRetrySave, submitting, sectionStarting }) {
  const numericExamId = Number(useParams().examId);

  useEffect(() => {
    if (!Number.isFinite(numericExamId)) return;
    if (examSession?.exam?.id === numericExamId && !examSession?.finishedAttempt) return;
    onLoadExam(numericExamId);
  }, [numericExamId, examSession?.exam?.id, examSession?.finishedAttempt]);

  if (!Number.isFinite(numericExamId)) return <Navigate to="/exams" replace />;
  if (!examSession || examSession.exam.id !== numericExamId) return <Loading text="正在加载试卷…" />;
  if (examSession.run?.status === "awaiting_section") {
    return <ExamSectionBreakView session={examSession} onStartNext={onStartNext} starting={sectionStarting} />;
  }
  if (!examSession.questions?.length) {
    return <div className="center-state error">当前科目没有可显示的题目。<button className="secondary-button" onClick={onBack} type="button">返回试卷列表</button></div>;
  }
  return (
    <ExamSessionView
      session={examSession}
      onBack={onBack}
      onChoose={onChoose}
      onMove={onMove}
      onSubmit={onSubmit}
      saveState={saveState}
      onRetrySave={onRetrySave}
      submitting={submitting}
    />
  );
}

export function ExamIntroRoute({ examSession, onLoadIntro, onBack, onStart, starting }) {
  const numericExamId = Number(useParams().examId);
  useEffect(() => {
    if (!Number.isFinite(numericExamId)) return;
    if (examSession?.exam?.id === numericExamId) return;
    onLoadIntro(numericExamId);
  }, [numericExamId, examSession?.exam?.id]);
  if (!Number.isFinite(numericExamId)) return <Navigate to="/exams" replace />;
  if (!examSession || examSession.exam.id !== numericExamId || examSession.phase !== "intro") return <Loading text="正在加载考试说明…" />;
  return <ExamIntroView exam={examSession.exam} onBack={onBack} onStart={onStart} starting={starting} />;
}

export function ExamReviewRoute({ examSession, onLoadReview, onBack, onRepeat }) {
  const { examId, attemptId } = useParams();
  const numericExamId = Number(examId);
  const numericAttemptId = Number(attemptId);
  const valid = Number.isFinite(numericExamId) && Number.isFinite(numericAttemptId);
  const loaded = Boolean(
    examSession?.exam?.id === numericExamId
    && examSession?.finishedAttempt
    && examSession?.reviewAttemptId === numericAttemptId,
  );

  useEffect(() => {
    if (valid && !loaded) onLoadReview(numericExamId, numericAttemptId);
  }, [numericExamId, numericAttemptId, examSession?.exam?.id, examSession?.reviewAttemptId]);

  if (!valid) return <Navigate to="/exams" replace />;
  if (!loaded) return <Loading text="正在加载复习内容…" />;
  return (
    <ExamResultView
      exam={examSession.exam}
      attempt={examSession.finishedAttempt}
      questions={examSession.questions}
      onRepeat={() => onRepeat(examSession.exam)}
      onLibrary={onBack}
    />
  );
}
