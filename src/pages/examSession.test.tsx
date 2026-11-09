// @vitest-environment jsdom
import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExamSessionView } from "./index";

describe("ExamSessionView timer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("automatically submits the current section when time expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T00:00:00Z"));
    const onSubmit = vi.fn();
    const question = {
      id: 1,
      layer_id: 1,
      order_index: 1,
      question_type: 21,
      title: "問題",
      passage: "",
      options: [{ id: 11, text: "A" }],
    };
    const session = {
      exam: {
        id: 1,
        level: "N5",
        title: "Test",
        layers: [{ id: 1, order_index: 1, title: "問題1", question_type: 21 }],
      },
      run: {
        id: 1,
        status: "in_progress",
        current_section: 0,
        section_expires_at: "2026-11-09T00:00:02Z",
        sections: [{ key: "grammar_reading", label: "文法・阅读" }],
      },
      questions: [question],
      index: 0,
      answers: {},
    };

    render(
      <ExamSessionView
        session={session}
        onBack={() => {}}
        onChoose={() => {}}
        onMove={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(true);
  });
});
