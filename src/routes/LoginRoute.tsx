import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, normalizeLevel, readUserLevelCache } from "../lib/study";
import { useAuthStore } from "../stores/auth";
import { usePreferencesStore } from "../stores/preferences";
import { LoginView, Shell } from "../pages";

// T-023 S4（A14/D16）：登录页独立路由 /login（原为 App 门禁内的内联 LoginView）。
// 保持 Shell 包裹与现有视觉；登录逻辑内聚：POST /api/auth/login → auth store setSession
// → 初始化 level → 回 /home。
export function LoginRoute() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const setAuthSession = useAuthStore((state) => state.setSession);
  const setLevel = usePreferencesStore((state) => state.setLevel);
  // 已登录访问 /login：回首页
  if (token) return <Navigate to="/home" replace />;

  async function login(form) {
    const session = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setAuthSession(session.token, session.user);
    setLevel(normalizeLevel(session.user?.current_level || readUserLevelCache(session.user?.id)));
    navigate("/home");
  }

  return (
    <Shell>
      <LoginView onLogin={login} />
    </Shell>
  );
}
