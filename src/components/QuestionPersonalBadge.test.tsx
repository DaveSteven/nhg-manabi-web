// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionPersonalBadge } from "./QuestionPersonalBadge";

const item = { my_attempts: 5, my_correct: 4, my_accuracy: 80 };

describe("QuestionPersonalBadge", () => {
  it("shows attempts and accuracy for an answered question", () => {
    const { container } = render(<QuestionPersonalBadge stats={new Map([[7, item]])} questionId={7} />);
    expect(container.textContent).toBe("已练习 5 次，正确率 80%");
    // 数字用 personal-num 强调；正确率 ≥80% 走松绿（good）
    expect(container.querySelector(".personal-num.good")?.textContent).toBe("80%");
  });

  it("colors accuracy by performance thresholds", () => {
    const { container: low } = render(<QuestionPersonalBadge stats={new Map([[7, { my_attempts: 3, my_correct: 1, my_accuracy: 33 }]])} questionId={7} />);
    expect(low.querySelector(".personal-num.low")?.textContent).toBe("33%");
    const { container: mid } = render(<QuestionPersonalBadge stats={new Map([[7, { my_attempts: 3, my_correct: 2, my_accuracy: 67 }]])} questionId={7} />);
    const midAccuracy = [...mid.querySelectorAll(".personal-num")].find((el) => el.textContent === "67%");
    expect(midAccuracy?.className).toBe("personal-num");
  });

  it("renders nothing for a question without personal stats (AC1)", () => {
    const { container } = render(<QuestionPersonalBadge stats={new Map([[7, item]])} questionId={8} />);
    expect(container.textContent).toBe("");
  });

  it("renders nothing while stats are still loading", () => {
    const { container } = render(<QuestionPersonalBadge stats={null} questionId={7} />);
    expect(container.textContent).toBe("");
  });
});
