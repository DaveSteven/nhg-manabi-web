import { create } from "zustand";
import { DEFAULT_LEVEL } from "../lib/study";
import { readDailyGoal, readPracticeMode, writeDailyGoal, writePracticeMode, type PracticeMode } from "../lib/appHelpers";

// T-023 S1：全局 UI 偏好与跨页待办状态从 App useState 迁入 zustand store。
// practiceMode / dailyGoal 的 setter 写穿 localStorage（沿用现有键名，可丢弃 UI 偏好——
// 见 docs/develop/state-management.md 规则 2）；level 初始值由 auth 恢复流程覆盖
// （App 挂载 effect / 登录成功，同原行为）。

interface PreferencesState {
  level: string;
  subject: string;
  practiceMode: PracticeMode;
  dailyGoal: number;
  /** 基础练习（/practice-setup）待开练习：{ source, quiz, mode } */
  pendingPractice: any;
  /** 全局错误（整页错误条，App 顶层渲染） */
  error: string;
  setLevel: (level: string) => void;
  setSubject: (subject: string) => void;
  setPracticeMode: (mode: string) => void;
  setDailyGoal: (goal: number) => void;
  setPendingPractice: (value: any) => void;
  setError: (message: string) => void;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  level: DEFAULT_LEVEL,
  subject: "grammar",
  practiceMode: readPracticeMode(),
  dailyGoal: readDailyGoal(),
  pendingPractice: null,
  error: "",
  setLevel: (level) => set({ level }),
  setSubject: (subject) => set({ subject }),
  setPracticeMode: (mode) => {
    writePracticeMode(mode as PracticeMode);
    set({ practiceMode: mode as PracticeMode });
  },
  setDailyGoal: (goal) => {
    writeDailyGoal(goal);
    set({ dailyGoal: goal });
  },
  setPendingPractice: (pendingPractice) => set({ pendingPractice }),
  setError: (error) => set({ error }),
}));
