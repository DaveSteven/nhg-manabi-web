import React from "react";
import { Navigate } from "react-router-dom";
import {
  BasicPracticeSetupView,
  GrammarPracticeSetupView,
  QuizView,
  ResultView,
  UnifiedPracticeSessionView,
} from "../pages";
import { PracticeResultView } from "../pages/PracticeResult";
import { usePreferencesStore } from "../stores/preferences";
import { useQuizSessionStore } from "../stores/quizSession";

// T-023 S3：quiz/专项练习域的路由组件——只读统一状态层（store）决定渲染分支，
// Route element 零业务 props（规则见 docs/develop/state-management.md 规则 3）。

/** /practice-setup：pendingPractice 不存在时（直接输入 URL / 开练 transition 间隙）不落设置页。 */
export function PracticeSetupRoute() {
  const pendingPractice = usePreferencesStore((state) => state.pendingPractice);
  const session = useQuizSessionStore((state) => state.quizSession);
  // 开始练习时 pendingPractice 先被清空、路由跳转在 transition 里稍后生效；这里已有会话就直接进 /quiz，别被弹回首页。
  if (!pendingPractice) return <Navigate to={session ? "/quiz" : "/home"} replace />;
  return <BasicPracticeSetupView />;
}

/** /:category-practice（vocabulary/grammar/reading）：结果 → 会话 → 恢复中 → 设置页。 */
export function PracticeCategoryRoute({ category }: { category: string }) {
  const grammarPractice = useQuizSessionStore((state) => state.grammarPractice);
  const quizRestoring = useQuizSessionStore((state) => state.quizRestoring);
  if (grammarPractice?.finishedAttempt) return <PracticeResultView />;
  if (grammarPractice) return <UnifiedPracticeSessionView />;
  if (quizRestoring) return <div className="center-state">正在恢复练习…</div>;
  return <GrammarPracticeSetupView category={category} />;
}

/** /quiz：结果 → 会话 → 恢复中 → 弹回首页。 */
export function QuizRoute() {
  const session = useQuizSessionStore((state) => state.quizSession);
  const quizRestoring = useQuizSessionStore((state) => state.quizRestoring);
  if (session?.finishedAttempt) return <ResultView />;
  if (session) return <QuizView />;
  if (quizRestoring) return <div className="center-state">正在恢复练习…</div>;
  return <Navigate to="/home" replace />;
}
