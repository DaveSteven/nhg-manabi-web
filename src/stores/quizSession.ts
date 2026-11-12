import { create } from "zustand";

// T-022 刀二：quiz（/quiz 的 book/mixed/错题/收藏流）与专项练习（grammarPractice）
// 会话状态从 App useState 迁入 store；事实源在服务端 practice_sessions（附 sessionId），
// 本 store 为客户端会话层（规则见 docs/develop/state-management.md）。

interface QuizSessionState {
  quizSession: any;
  grammarPractice: any;
  practiceSubmitting: boolean;
  quizSaveState: string;
  quizRestoring: boolean;
  setQuizSession: (updater: any) => void;
  setGrammarPractice: (updater: any) => void;
  setPracticeSubmitting: (value: boolean) => void;
  setQuizSaveState: (value: string) => void;
  setQuizRestoring: (value: boolean) => void;
}

export const useQuizSessionStore = create<QuizSessionState>((set) => ({
  quizSession: null,
  grammarPractice: null,
  practiceSubmitting: false,
  quizSaveState: "idle",
  // 初始 true：/quiz 守卫在首帧渲染（早于恢复 effect）时不能误判「无会话」而跳回首页
  quizRestoring: true,
  setQuizSession: (updater) =>
    set((state) => ({
      quizSession: typeof updater === "function" ? updater(state.quizSession) : updater,
    })),
  setGrammarPractice: (updater) =>
    set((state) => ({
      grammarPractice: typeof updater === "function" ? updater(state.grammarPractice) : updater,
    })),
  setPracticeSubmitting: (value) => set({ practiceSubmitting: value }),
  setQuizSaveState: (value) => set({ quizSaveState: value }),
  setQuizRestoring: (value) => set({ quizRestoring: value }),
}));
