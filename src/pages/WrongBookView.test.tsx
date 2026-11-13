// @vitest-environment jsdom
// T-023 S3 适配：WrongBookView 改为自取数据（stores + useStudyDerived），测试改为
// seed auth/preferences store + 注入 study-data Query 缓存，不再以 props 传入错题列表。
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WrongBookView } from "./index";
import { useAuthStore } from "../stores/auth";
import { usePreferencesStore } from "../stores/preferences";

afterEach(cleanup);

function makeItem(index, source = "library") {
  return {
    key: `${source}:${index}`,
    source,
    stem: `题目 ${index}`,
    subject: source === "library" ? "grammar" : "vocabulary",
    subjectLabel: source === "library" ? "文法" : "文字词汇",
    bookName: source === "library" ? "基础练习" : "专项练习",
    answerText: `答案 ${index}`,
    wrongCount: 1,
    lastChosenText: `选择 ${index}`,
    lastWrongAt: new Date(2026, 10, index).toISOString(),
  };
}

// study-data 的 Query 键为 ["study-data", userId, level]（见 hooks/useLibraryData.ts）。
// staleTime 内视为新鲜，注入后组件不会重新发请求。
function renderWithStudyData(wrongItems: any[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  client.setQueryData(["study-data", 1, "N3"], {
    attempts: [],
    wrongItems,
    examAttempts: [],
    examRuns: [],
    practiceAttempts: [],
    practiceWrongItems: [],
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WrongBookView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ token: "test-token", currentUser: { id: 1, username: "tester", current_level: "N3" } });
  usePreferencesStore.setState({ level: "N3" });
});

describe("WrongBookView", () => {
  it("shows ten wrong questions per page and navigates to the remainder", () => {
    const items = Array.from({ length: 12 }, (_, index) => makeItem(index + 1));
    renderWithStudyData(items);

    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(screen.getByText("第 1 / 2 页")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("第 2 / 2 页")).toBeTruthy();
  });

  it("makes the included and excluded sources explicit", () => {
    renderWithStudyData([makeItem(1), makeItem(2, "practice")]);

    expect(screen.getByText("基础题库 1 题 · 专项练习 1 题")).toBeTruthy();
    expect(screen.getByText("专项练习包括文字词汇、文法和读解；整套真题与听力训练暂未收录。")).toBeTruthy();
  });
});

it.each(["library", "practice"])("uses one review action for %s questions", (source) => {
  const onReview = vi.fn();
  void onReview; // 复习动作已内聚到 useQuizFlow.startWrongReview，这里只验证入口按钮唯一
  renderWithStudyData([makeItem(1, source), makeItem(2, "practice")]);
  const reviewButtons = screen.getAllByRole("button", { name: /复习/ });
  expect(reviewButtons).toHaveLength(1);
});
