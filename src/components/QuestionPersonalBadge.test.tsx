// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionPersonalBadge } from "./QuestionPersonalBadge";

const item = { my_attempts: 5, my_correct: 4, my_accuracy: 80 };

describe("QuestionPersonalBadge", () => {
  it("shows attempts and accuracy for an answered question", () => {
    render(<QuestionPersonalBadge stats={new Map([[7, item]])} questionId={7} />);
    expect(screen.getByText("已练习 5 次，正确率 80%")).toBeTruthy();
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
