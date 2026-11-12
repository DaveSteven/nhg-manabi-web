import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { applyTheme, readThemePref } from "./lib/theme";
import "./styles/index.scss";

// T-022 刀一：服务端状态统一走 TanStack Query（规则见 docs/develop/state-management.md）。
// staleTime 默认 0 保持现有每次挂载拉取语义；各域 Query 自行覆盖。
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// 方案一 U5: seasonal accent — only --sakura/--sakura-soft shift, theme colors untouched.
const month = new Date().getMonth() + 1;
const season = month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
document.documentElement.dataset.season = season;

// 方案一 U6: two-state theme (light default / dark), persisted in localStorage.
applyTheme(readThemePref());

createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
);
