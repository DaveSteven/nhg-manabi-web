import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./stores/auth";
import { RequireAuth } from "./routes/RequireAuth";
import { LoginRoute } from "./routes/LoginRoute";
import { ExamIntroRoute, ExamReviewRoute, ExamRoute } from "./routes/ExamRoutes";
import { PracticeCategoryRoute, PracticeSetupRoute, QuizRoute } from "./routes/PracticeRoutes";
import {
  ExamListView,
  FavoritesView,
  LibraryView,
  SearchView,
  UserView,
  WrongBookView,
  PRACTICE_CATEGORIES,
} from "./pages";

import Listening from "./pages/Listening";
import { StatsView } from "./pages/StatsPages";

// T-023 S4/S5（A14/D16）：App 收敛为纯路由组合。
// /login 独立页；/home 承载首页；/ 按登录态分流（根路径预留给未来宣传页，另行立项）；
// 业务路由统一包在 RequireAuth 门卫下（auth 恢复、加载/错误态、quiz 会话恢复都在门卫内）。

function RootRedirect() {
  const token = useAuthStore((state) => state.token);
  return <Navigate to={token ? "/home" : "/login"} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/" element={<RootRedirect />} />
      <Route element={<RequireAuth />}>
        <Route path="/home" element={<LibraryView />} />
        <Route path="/listening/:examId?/:questionId?" element={<Listening />} />
        <Route path="/search" element={<SearchView />} />
        <Route path="/practice-setup" element={<PracticeSetupRoute />} />
        {Object.keys(PRACTICE_CATEGORIES).map((category) => (
          <Route key={category} path={`/${category}-practice`} element={<PracticeCategoryRoute category={category} />} />
        ))}
        <Route path="/quiz" element={<QuizRoute />} />
        <Route path="/favorites" element={<FavoritesView />} />
        <Route path="/wrong" element={<WrongBookView />} />
        <Route path="/stats" element={<StatsView />} />
        <Route path="/user" element={<UserView />} />
        <Route path="/exams" element={<ExamListView />} />
        <Route path="/exams/:examId/start" element={<ExamIntroRoute />} />
        <Route path="/exams/:examId" element={<ExamRoute />} />
        <Route path="/exams/:examId/review/:attemptId" element={<ExamReviewRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default App;
