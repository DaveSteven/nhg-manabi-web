import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SESSION_TOKEN_KEY } from "../lib/study";

// T-022 刀一：auth 迁入 zustand persist（对齐管理端 B1 先例：只存 token，
// currentUser 由 App 挂载时 /api/me 会话恢复——见 state-management.md 规则 2）。

type AuthUser = any;

interface AuthState {
  token: string | null;
  currentUser: AuthUser;
  setSession: (token: string, user: AuthUser) => void;
  setUser: (updater: AuthUser | ((current: AuthUser) => AuthUser)) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      currentUser: null,
      setSession: (token, user) => set({ token, currentUser: user }),
      setUser: (updater) =>
        set((state) => ({
          currentUser: typeof updater === "function" ? updater(state.currentUser) : updater,
        })),
      clear: () => set({ token: null, currentUser: null }),
    }),
    {
      name: "auth-storage",
      // 只持久化 token；currentUser 永不落盘
      partialize: (state) => ({ token: state.token }),
    },
  ),
);

// 一次性迁移：旧键 japanese-study-session-token 的 token 收编进 store 后退役旧键。
// 模块加载即执行（localStorage 同步），早于 App 首帧渲染。
const legacyToken = localStorage.getItem(SESSION_TOKEN_KEY);
if (legacyToken) {
  if (!useAuthStore.getState().token) {
    useAuthStore.setState({ token: legacyToken });
  }
  localStorage.removeItem(SESSION_TOKEN_KEY);
}
