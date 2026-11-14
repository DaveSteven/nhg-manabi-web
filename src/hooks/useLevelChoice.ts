import { useCallback } from "react";
import { api, normalizeLevel, writeUserLevelCache } from "../lib/study";
import { useAuthStore } from "../stores/auth";
import { usePreferencesStore } from "../stores/preferences";

/**
 * T-034：等级切换共享逻辑（原 LibraryView.chooseLevel）——
 * 本地缓存 + 服务端保存（best-effort，失败退回本地缓存）。
 * 首页书库与用户页「备考目标」两处复用；切换后书库过滤自然跟随。
 */
export default function useLevelChoice() {
  const authToken = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const setLevel = usePreferencesStore((state) => state.setLevel);

  return useCallback(async (nextLevel: string) => {
    const normalized = normalizeLevel(nextLevel);
    setLevel(normalized);
    if (currentUser) {
      writeUserLevelCache(currentUser.id, normalized);
      setAuthUser((user) => user ? { ...user, current_level: normalized } : user);
    }
    if (!authToken || !currentUser || currentUser.current_level === normalized) return;

    try {
      const updatedUser = await api("/api/me/level", {
        method: "POST",
        body: JSON.stringify({ current_level: normalized }),
      }, authToken);
      setAuthUser(updatedUser);
      writeUserLevelCache(updatedUser.id, updatedUser.current_level);
    } catch (err) {
      console.warn("Could not save current level to the API; using local cache.", err);
    }
  }, [authToken, currentUser, setAuthUser, setLevel]);
}
