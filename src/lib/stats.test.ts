import { describe, expect, it } from "vitest";
import { compareRecentActivity, efficiencyView, examPerformanceView, examScoreDelta, formatDuration, heatLevel, sessionDurationSeconds, weekDots } from "./stats";

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

describe("efficiency view model (T-014)", () => {
  it("maps efficiency snake_case contract and computes weighted speed delta", () => {
    const view = efficiencyView({
      coverage: { eligible_attempts: 12, with_duration: 10, ratio: 0.83 },
      avg_seconds_per_question: 28.4,
      speed_trend: [
        { period: "2026-11-01", avg_seconds: 40, answered: 10 },
        { period: "2026-11-02", avg_seconds: 40, answered: 10 },
        { period: "2026-11-03", avg_seconds: 20, answered: 10 },
        { period: "2026-11-04", avg_seconds: 20, answered: 10 },
      ],
      time_distribution: [
        { kind: "practice", label: "专项练习", seconds: 3600, pct: 55.0 },
        { kind: "exam", label: "模拟考试", seconds: 2400, pct: 30.0 },
        { kind: "listening", label: "听力精听", seconds: 1200, pct: 15.0 },
      ],
    });
    expect(view.avgSeconds).toBe(28.4);
    expect(view.coverage).toEqual({ eligible: 12, withDuration: 10, ratio: 0.83 });
    expect(view.trend).toHaveLength(4);
    expect(view.distribution.map((item) => item.kind)).toEqual(["practice", "exam", "listening"]);
    expect(view.ready).toBe(true);
    // 前半加权 40、后半加权 20 → 快 20 秒/题
    expect(view.deltaSeconds).toBe(-20);
    expect(view.conclusion).toBe("比前半期快 20 秒/题");
  });

  it("marks low coverage and empty data as not ready", () => {
    const lowCoverage = efficiencyView({
      coverage: { eligible_attempts: 10, with_duration: 3, ratio: 0.3 },
      avg_seconds_per_question: 30,
      speed_trend: [{ period: "2026-11-01", avg_seconds: 30, answered: 9 }],
      time_distribution: [{ kind: "practice", label: "专项练习", seconds: 270, pct: 100.0 }],
    });
    expect(lowCoverage.ready).toBe(false);

    const empty = efficiencyView(null);
    expect(empty).toMatchObject({
      avgSeconds: null,
      ready: false,
      deltaSeconds: null,
      conclusion: "暂无足够的速度对比数据",
    });
    expect(empty.trend).toEqual([]);
    expect(empty.distribution).toEqual([]);
  });

  it("reports stable speed when halves differ within 1 second", () => {
    const view = efficiencyView({
      coverage: { eligible_attempts: 2, with_duration: 2, ratio: 1 },
      avg_seconds_per_question: 30.0,
      speed_trend: [
        { period: "2026-11-01", avg_seconds: 30.4, answered: 10 },
        { period: "2026-11-02", avg_seconds: 30.0, answered: 10 },
      ],
    });
    expect(view.deltaSeconds).toBe(0);
    expect(view.conclusion).toBe("答题速度保持稳定");
  });
});

describe("session duration seconds (T-014)", () => {
  it("computes positive seconds from a valid start", () => {
    const startedAt = new Date(Date.now() - 65_000).toISOString();
    expect(sessionDurationSeconds(startedAt)).toBeGreaterThanOrEqual(64);
    expect(sessionDurationSeconds(startedAt)).toBeLessThanOrEqual(66);
  });

  it("returns undefined for missing, invalid or future starts", () => {
    expect(sessionDurationSeconds(undefined)).toBeUndefined();
    expect(sessionDurationSeconds("")).toBeUndefined();
    expect(sessionDurationSeconds("not-a-date")).toBeUndefined();
    expect(sessionDurationSeconds(new Date(Date.now() + 60_000).toISOString())).toBeUndefined();
  });
});

describe("formatDuration (T-014)", () => {
  it("formats seconds, minutes and hours compactly", () => {
    expect(formatDuration(45)).toBe("45 秒");
    expect(formatDuration(60)).toBe("1 分");
    expect(formatDuration(200)).toBe("3 分 20 秒");
    expect(formatDuration(4800)).toBe("1 小时 20 分");
    expect(formatDuration(3600)).toBe("1 小时");
  });
});

describe("weekDots (T-030 连续周卡)", () => {
  const activity = [
    { date: "2026-11-09", answered: 10 },
    { date: "2026-11-11", answered: 5 },
    { date: "2026-11-12", answered: 0 },
  ];

  it("maps Monday→Sunday with answered>0 and future days as placeholders", () => {
    // 2026-11-13 是周五：周一~周五已发生，周六/周日为未来空位
    const dots = weekDots(activity, new Date(2026, 10, 13));
    expect(dots.map((dot) => dot.date)).toEqual([
      "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15",
    ]);
    expect(dots.map((dot) => dot.answered)).toEqual([10, 0, 5, 0, 0, 0, 0]);
    expect(dots.map((dot) => dot.future)).toEqual([false, false, false, false, false, true, true]);
    // T-033：仅今天（周五 11-13）标记 isToday
    expect(dots.map((dot) => dot.isToday)).toEqual([false, false, false, false, true, false, false]);
  });

  it("treats today itself as past (not a future placeholder)", () => {
    // 2026-11-09 是周一：当天 answered 数据应点亮周一
    const dots = weekDots([{ date: "2026-11-09", answered: 3 }], new Date(2026, 10, 9, 8));
    expect(dots[0]).toEqual({ date: "2026-11-09", answered: 3, future: false, isToday: true });
    expect(dots.slice(1).every((dot) => dot.future)).toBe(true);
  });

  it("starts the week on Monday even mid-week and handles Sunday", () => {
    // 2026-11-15 是周日：周一仍是 11-09
    const dots = weekDots([], new Date(2026, 10, 15));
    expect(dots[0].date).toBe("2026-11-09");
    expect(dots[6].date).toBe("2026-11-15");
    expect(dots[6].future).toBe(false);
  });
});
