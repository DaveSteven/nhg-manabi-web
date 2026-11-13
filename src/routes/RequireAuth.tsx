import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  SUBJECTS,
  api,
  normalizeLevel,
  readUserLevelCache,
} from "../lib/study";
import { useAuthStore } from "../stores/auth";
import { usePreferencesStore } from "../stores/preferences";
import { useQuizSessionRestore } from "../hooks/useQuizFlow";
import { useStudyDerived } from "../hooks/useStudyDerived";
import { fetchBooks, useBooks, useExams } from "../hooks/useLibraryData";
import { Shell } from "../pages";

// T-023 S4：顶层门卫（A14）。auth 恢复（/api/me）、加载/错误态与 quiz 会话服务端恢复统一收在这里：
// loading → 加载态；未登录 → 重定向 /login；已登录 → 渲染子路由（业务路由全部包在其下）。
export function RequireAuth() {
  const queryClient = useQueryClient();
  const authToken = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clear);
  const level = usePreferencesStore((state) => state.level);
  const setLevel = usePreferencesStore((state) => state.setLevel);
  const subject = usePreferencesStore((state) => state.subject);
  const error = usePreferencesStore((state) => state.error);
  const setError = usePreferencesStore((state) => state.setError);
  const [loading, setLoading] = useState(true);
  // 错误门集合：与视图共享同一份 Query 缓存，只观察不额外请求
  const booksQuery = useBooks(level, subject, authToken, currentUser?.id);
  const examsQuery = useExams(level, authToken, currentUser?.id);
  const { studyQuery } = useStudyDerived();
  // quiz 会话服务端恢复 effect——此处顶层挂载一次（多视图重复挂载会覆盖进行中会话）
  useQuizSessionRestore();
  // D18 路由过渡：keyed fade，pathname 变化时 remount 触发 150ms 入场动画
  const { pathname } = useLocation();

  // auth 恢复（/api/me）：token 有效则带出 currentUser 并同步等级偏好
  useEffect(() => {
    let ignore = false;
    async function restoreSession() {
      setLoading(true);
      setError("");
      try {
        const restoredUser = authToken ? await api("/api/me", {}, authToken) : null;
        if (!ignore) {
          setAuthUser(restoredUser);
          if (restoredUser) {
            setLevel(normalizeLevel(restoredUser.current_level || readUserLevelCache(restoredUser.id)));
          }
        }
      } catch (err) {
        if (!ignore) {
          clearAuth();
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    restoreSession();
    return () => {
      ignore = true;
    };
  }, []);

  // 拉取失败统一透出到页面错误条
  useEffect(() => {
    const queryError = booksQuery.error || examsQuery.error || studyQuery.error;
    if (queryError) setError(`データを読み込めませんでした: ${queryError.message}`);
  }, [booksQuery.error, examsQuery.error, studyQuery.error]);

  // 后台预取同等级其他科目的 books，让首次切换 tab 也能命中缓存
  useEffect(() => {
    if (!authToken || !currentUser) return;
    SUBJECTS.forEach((item) => {
      if (item.id !== subject) {
        queryClient.prefetchQuery({
          queryKey: ["books", currentUser.id, level, item.id],
          queryFn: () => fetchBooks(level, item.id, authToken),
          staleTime: 60_000,
        });
      }
    });
  }, [authToken, currentUser, level, subject, queryClient]);

  if (loading) return <Shell><div className="center-state">正在加载题库…</div></Shell>;
  if (!authToken || !currentUser) return <Navigate to="/login" replace />;
  if (error) return <Shell><div className="center-state error">{error}</div></Shell>;
  // Shell（.app-shell > .app-frame 容器）必须包裹业务路由——原 App 整体在 Shell 内，容器丢失会失去顶部间距与页宽
  return (
    <Shell>
      <div key={pathname} className="route-fade">
        <Outlet />
      </div>
    </Shell>
  );
}
