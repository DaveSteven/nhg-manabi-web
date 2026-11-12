// @vitest-environment jsdom
// 复现用户反馈：专项练习选了答案 → 退出 → 再进入，选中状态应被重置。
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { useAuthStore } from "./stores/auth";

const user = { id: 1, username: "tester", current_level: "N5" };

const question = {
  id: 101,
  external_id: "q101",
  layer_id: 5,
  layer_external_id: "l5",
  order_index: 1,
  question_type: 21,
  data_type: "text",
  title: "テスト文法問題",
  passage: "",
  subtitle: "",
  segment_count: 0,
  image_url: null,
  media_url: null,
  options: [
    { id: 1001, text: "选项一", source_order: 1 },
    { id: 1002, text: "选项二", source_order: 2 },
    { id: 1003, text: "选项三", source_order: 3 },
    { id: 1004, text: "选项四", source_order: 4 },
  ],
};

const exam = {
  id: 1,
  title: "2020年12月 N5",
  level: "N5",
  listening_num: 5,
};

function jsonResponse(data: any) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function fakeFetch(url: any, options: any = {}) {
  const raw = String(url instanceof Request ? url.url : url);
  const path = raw.replace(/^https?:\/\/[^/]+/, "");
  const method = (options.method || "GET").toUpperCase();
  if (path === "/api/me") return jsonResponse(user);
  if (path.startsWith("/api/books")) return jsonResponse([]);
  if (path.startsWith("/api/exams?")) return jsonResponse([exam]);
  if (path.startsWith("/api/exam-practice/random")) {
    return jsonResponse([{ ...question, exam_id: exam.id, exam_title: exam.title, practice_order: 1 }]);
  }
  if (path.startsWith("/api/exam-practice/check")) {
    return jsonResponse({
      question_id: question.id,
      title: question.title,
      chosen_option_id: 1002,
      chosen_text: "选项二",
      correct_option_id: 1001,
      answer_text: "选项一",
      analysis: "",
      is_correct: false,
    });
  }
  if (
    ["/api/attempts", "/api/wrong-questions", "/api/exam-attempts", "/api/exam-runs", "/api/practice-attempts", "/api/practice-wrong-questions"]
      .some((prefix) => path.startsWith(prefix))
  ) {
    return jsonResponse([]);
  }
  throw new Error(`Unhandled fake-fetch request: ${method} ${path}`);
}

async function startPractice() {
  const startButton = (await screen.findByRole("button", { name: /开始专项练习/ })) as HTMLButtonElement;
  await waitFor(() => expect(startButton.disabled).toBe(false));
  fireEvent.click(startButton);
  await screen.findByText(question.title);
}

beforeEach(() => {
  localStorage.clear();
  // T-022 刀一：auth 在 zustand store，直接 seed（App 会以 token 走 /api/me 恢复 currentUser）
  useAuthStore.setState({ token: "test-token", currentUser: null });
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("专项练习退出后答案重置", () => {
  it("退出再进入后，之前选中的选项不应保持选中", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/grammar-practice"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // 第一次进入：开始练习并选择一个选项
    await startPractice();
    const option = screen.getByRole("button", { name: /选项二/ });
    fireEvent.click(option);
    await waitFor(() => expect(option.className).toContain("selected"));

    // 退出练习（页头返回 → 退出弹窗 → 退出练习）
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    fireEvent.click(await screen.findByRole("button", { name: "退出练习" }));

    // 回到设置页，再次开始
    await startPractice();

    // 第二次进入：同一选项不应处于选中状态
    const optionAgain = screen.getByRole("button", { name: /选项二/ });
    expect(optionAgain.className).not.toContain("selected");
  });
});
