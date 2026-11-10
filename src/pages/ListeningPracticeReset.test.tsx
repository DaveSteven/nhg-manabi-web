// @vitest-environment jsdom
// 复现用户反馈：听力专项（指定试卷）选了答案 → 退出 → 再进入，上次的选中状态和解析不应被带回。
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Listening from "./Listening";
import { SESSION_TOKEN_KEY } from "../lib/study";

const userId = 1;
const progressKey = `listening:${userId}`;
const exam = { id: 7, title: "2019年12月 N5", level: "N5", listening_num: 4 };

const question = {
  id: 101,
  external_id: "q101",
  layer_id: 9,
  order_index: 1,
  question_type: 41,
  title: "<p>問題1</p>",
  passage: "",
  subtitle: "",
  translation: "",
  image_url: null,
  media_url: "audio/q101.mp3",
  options: [
    { id: 1001, text: "选项一", source_order: 1 },
    { id: 1002, text: "选项二", source_order: 2 },
    { id: 1003, text: "选项三", source_order: 3 },
    { id: 1004, text: "选项四", source_order: 4 },
  ],
};

const savedResult = {
  question_id: 101,
  title: question.title,
  chosen_option_id: 1002,
  chosen_text: "选项二",
  correct_option_id: 1001,
  answer_text: "选项一",
  analysis: "<p>解析</p>",
  is_correct: false,
  segments: [],
};

function jsonResponse(data: any) {
  return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
}

function fakeFetch(url: any, options: any = {}) {
  const raw = String(url instanceof Request ? url.url : url);
  const path = raw.replace(/^https?:\/\/[^/]+/, "");
  if (path === `/api/exams?level=N5`) return jsonResponse([exam]);
  if (path === `/api/exams/${exam.id}`) return jsonResponse({ ...exam, layers: [] });
  if (path === `/api/exams/${exam.id}/questions`) return jsonResponse([question]);
  if (path === "/api/listening/check") return jsonResponse(savedResult);
  throw new Error(`Unhandled fake-fetch request: ${path}`);
}

async function startExamPractice() {
  fireEvent.click(await screen.findByRole("radio", { name: /指定试卷/ }));
  fireEvent.click(screen.getByRole("button", { name: /开始听力专项/ }));
  await screen.findByText(/听完音频后选择答案/);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(SESSION_TOKEN_KEY, "test-token");
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("听力专项退出后答案重置", () => {
  it("上次会话写入 localStorage 的选项与解析，不应在新的练习里恢复", async () => {
    // 上一次练习留下的作答（指定试卷 → 同一批题会再次出现）
    localStorage.setItem(progressKey, JSON.stringify({
      [question.id]: { examId: exam.id, started: true, choice: 1002, result: savedResult },
    }));

    render(
      <MemoryRouter initialEntries={["/listening"]}>
        <Routes>
          <Route path="/listening/:examId?/:questionId?" element={<Listening userId={userId} token="test-token" globalLevel="N5" />} />
        </Routes>
      </MemoryRouter>,
    );

    await startExamPractice();

    // 选项二不应保持选中，也不应直接显示上次的判定结果
    const option = await screen.findByRole("button", { name: /选项二/ });
    await waitFor(() => expect(option.className).not.toContain("selected"));
    expect(screen.queryByText("这次没有选对")).toBeNull();
  });

  it("本次练习中选择的答案仍应正常标记选中", async () => {
    render(
      <MemoryRouter initialEntries={["/listening"]}>
        <Routes>
          <Route path="/listening/:examId?/:questionId?" element={<Listening userId={userId} token="test-token" globalLevel="N5" />} />
        </Routes>
      </MemoryRouter>,
    );

    await startExamPractice();
    const option = await screen.findByRole("button", { name: /选项二/ });
    fireEvent.click(option);
    await waitFor(() => expect(option.className).toContain("selected"));
  });
});
