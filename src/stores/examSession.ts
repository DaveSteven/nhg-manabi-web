import { create } from "zustand";

// T-022 刀一：模考会话及保存状态从 useExamFlow 的 useState 迁入全局 store，
// 供路由守卫（刀一 ①-3）与页面消费。examSession 形状见 useExamFlow：
// { exam, run?, allQuestions?, questions, index, answers, finishedAttempt?, reviewAttemptId?, phase? }

interface ExamSessionState {
  examSession: any;
  examStarting: boolean;
  examSectionStarting: boolean;
  examSubmitting: boolean;
  examSaveState: string;
  setExamSession: (updater: any) => void;
  setExamStarting: (value: boolean) => void;
  setExamSectionStarting: (value: boolean) => void;
  setExamSubmitting: (value: boolean) => void;
  setExamSaveState: (value: string) => void;
}

export const useExamSessionStore = create<ExamSessionState>((set) => ({
  examSession: null,
  examStarting: false,
  examSectionStarting: false,
  examSubmitting: false,
  examSaveState: "idle",
  setExamSession: (updater) =>
    set((state) => ({
      examSession: typeof updater === "function" ? updater(state.examSession) : updater,
    })),
  setExamStarting: (value) => set({ examStarting: value }),
  setExamSectionStarting: (value) => set({ examSectionStarting: value }),
  setExamSubmitting: (value) => set({ examSubmitting: value }),
  setExamSaveState: (value) => set({ examSaveState: value }),
}));
