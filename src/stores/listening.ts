import { create } from "zustand";
import { persist } from "zustand/middleware";

// T-022 刀三 ③-3：听力播放进度收编 zustand persist store（取舍 3：可丢弃缓存，不上服务端）。
// 结构按用户分桶：progressByUser[userId][questionId] = { done, ... }，服务端不感知。

interface ListeningState {
  progressByUser: Record<string, Record<string, any>>;
  /** 听力专项练习会话（刀三补：含 userId 与 startedAt，刷新恢复；退出/完成由页面清除） */
  practiceSession: any;
  saveProgress: (userId: string, patch: Record<string, any>) => void;
  setPracticeSession: (updater: any) => void;
}

export const useListeningStore = create<ListeningState>()(
  persist(
    (set) => ({
      progressByUser: {},
      practiceSession: null,
      saveProgress: (userId, patch) =>
        set((state) => ({
          progressByUser: {
            ...state.progressByUser,
            [userId]: { ...(state.progressByUser[userId] || {}), ...patch },
          },
        })),
      setPracticeSession: (updater) =>
        set((state) => ({
          practiceSession: typeof updater === "function" ? updater(state.practiceSession) : updater,
        })),
    }),
    { name: "listening-storage" },
  ),
);

// 一次性迁移：旧散键 listening:<userId> 收编进 store 后退役
(function migrateLegacyListeningProgress() {
  const legacy: Record<string, Record<string, any>> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    const match = key?.match(/^listening:(.+)$/);
    if (!match) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      if (value && typeof value === "object" && !Array.isArray(value)) legacy[match[1]] = value;
    } catch {
      /* 损坏数据直接丢弃 */
    }
  }
  if (Object.keys(legacy).length) {
    useListeningStore.setState((state) => ({
      progressByUser: { ...legacy, ...state.progressByUser },
    }));
    Object.keys(legacy).forEach((userId) => localStorage.removeItem(`listening:${userId}`));
  }
})();
