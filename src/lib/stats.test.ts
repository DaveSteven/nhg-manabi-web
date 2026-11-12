import { describe, expect, it } from "vitest";
import { compareRecentActivity, examPerformanceView, examScoreDelta, heatLevel } from "./stats";

describe("statistics calculations", () => {
  it("compares recent question volume and weighted accuracy", () => {
    const activity = [
      { answered: 10, correct: 5 },
      { answered: 10, correct: 7 },
      { answered: 20, correct: 16 },
      { answered: 20, correct: 18 },
    ];
    expect(compareRecentActivity(activity, 2)).toMatchObject({
      volumeChange: 100,
      accuracyChange: 25,
    });
  });

  it("maps activity into a stable five-step heat scale", () => {
    expect([0, 1, 5, 10, 20].map((value) => heatLevel(value, 20))).toEqual([0, 1, 1, 2, 4]);
  });

  it("maps exam performance snake_case contract into view model", () => {
    const view = examPerformanceView({
      points: [
        {
          attempt_id: 7,
          exam_id: 3,
          title: "2019年12月 N2 真题",
          level: "N2",
          correct: 72,
          total: 100,
          score: 72.0,
          created_at: "2026-11-11T10:00:00",
        },
      ],
      by_section: [
        {
          section: "language",
          label: "言語知識",
          correct: 40,
          total: 60,
          accuracy: 66.7,
          parts: [
            { subject: "vocabulary", label: "词汇", correct: 25, total: 30, accuracy: 83.3 },
            { subject: "grammar", label: "语法", correct: 15, total: 30, accuracy: 50.0 },
          ],
        },
        { section: "reading", label: "读解", correct: 0, total: 0, accuracy: null, parts: [] },
      ],
      goal: { enabled: false, goal_pct: null },
    });

    expect(view.points).toEqual([
      {
        attemptId: 7,
        examId: 3,
        title: "2019年12月 N2 真题",
        level: "N2",
        correct: 72,
        total: 100,
        score: 72.0,
        createdAt: "2026-11-11T10:00:00",
      },
    ]);
    expect(view.sections[0]).toEqual({
      section: "language",
      label: "言語知識",
      correct: 40,
      total: 60,
      accuracy: 66.7,
      parts: [
        { subject: "vocabulary", label: "词汇", correct: 25, total: 30, accuracy: 83.3 },
        { subject: "grammar", label: "语法", correct: 15, total: 30, accuracy: 50.0 },
      ],
    });
    expect(view.sections[1].parts).toEqual([]);
    expect(view.goal).toEqual({ enabled: false, goal_pct: null });
  });

  it("falls back to empty view for missing exam performance data", () => {
    expect(examPerformanceView(null)).toEqual({
      points: [],
      sections: [],
      goal: { enabled: false, goal_pct: null },
    });
  });

  it("computes exam score delta from the last two curve points", () => {
    const points = [
      { score: 50.0 },
      { score: 72.0 },
      { score: 65.5 },
    ];
    expect(examScoreDelta(points)).toBe(-6.5);
    expect(examScoreDelta([{ score: 72.0 }])).toBe(null);
    expect(examScoreDelta([])).toBe(null);
    expect(examScoreDelta([{ score: 50.0 }, { score: null }])).toBe(null);
  });
});
