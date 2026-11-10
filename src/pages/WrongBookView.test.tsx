// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WrongBookView } from "./index";

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

describe("WrongBookView", () => {
  it("shows ten wrong questions per page and navigates to the remainder", () => {
    const items = Array.from({ length: 12 }, (_, index) => makeItem(index + 1));
    render(<WrongBookView level="N3" items={items} onBack={() => {}} onReview={() => {}} />);

    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(screen.getByText("第 1 / 2 页")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("第 2 / 2 页")).toBeTruthy();
  });

  it("makes the included and excluded sources explicit", () => {
    render(<WrongBookView level="N3" items={[makeItem(1), makeItem(2, "practice")]} onBack={() => {}} onReview={() => {}} />);

    expect(screen.getByText("基础题库 1 题 · 专项练习 1 题")).toBeTruthy();
    expect(screen.getByText("专项练习包括文字词汇、文法和读解；整套真题与听力训练暂未收录。")).toBeTruthy();
  });
});

it.each(["library", "practice"])("uses one review action for %s questions", (source) => {
  const onReview = vi.fn();
  render(<WrongBookView level="N3" items={[makeItem(1, source), makeItem(2, "practice")]} onBack={() => {}} onReview={onReview} />);
  const reviewButtons = screen.getAllByRole("button", { name: /复习/ });
  expect(reviewButtons).toHaveLength(1);
  fireEvent.click(reviewButtons[0]);
  expect(onReview).toHaveBeenCalledTimes(1);
});
