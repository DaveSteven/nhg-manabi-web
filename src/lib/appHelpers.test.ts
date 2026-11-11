// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { countTodayQuestions, PRACTICE_MODE_KEY, practiceQuestionGroups, readPracticeMode, writePracticeMode } from "./appHelpers";

describe("practice mode preference", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to instant and remembers a valid selection", () => {
    expect(readPracticeMode()).toBe("instant");
    writePracticeMode("immersive");
    expect(localStorage.getItem(PRACTICE_MODE_KEY)).toBe("immersive");
    expect(readPracticeMode()).toBe("immersive");
  });

  it("ignores an unknown stored value", () => {
    localStorage.setItem(PRACTICE_MODE_KEY, "exam");
    expect(readPracticeMode()).toBe("instant");
  });
});

describe("practiceQuestionGroups", () => {
  it("keeps shared reading material together and leaves ordinary questions separate", () => {
    const questions = [
      { id: 1, question_type: 31, source_exam_id: 8, source_layer_id: 10, passage: "文章" },
      { id: 2, question_type: 31, source_exam_id: 8, source_layer_id: 10, passage: "文章" },
      { id: 3, question_type: 11, source_exam_id: 8, source_layer_id: 20 },
      { id: 4, question_type: 11, source_exam_id: 8, source_layer_id: 20 },
    ];
    const groups = practiceQuestionGroups(questions);
    expect(groups.map((group) => group.questions.map((question) => question.id))).toEqual([[1, 2], [3], [4]]);
  });

  it("splits a multi-article layer into one group per passage", () => {
    const questions = [
      { id: 1, question_type: 32, exam_id: 8, layer_id: 10, passage: "<p>甲の文章</p>" },
      { id: 2, question_type: 32, exam_id: 8, layer_id: 10, passage: "<p>甲の文章</p>" },
      { id: 3, question_type: 32, exam_id: 8, layer_id: 10, passage: "<p>乙の文章</p>" },
      { id: 4, question_type: 32, exam_id: 8, layer_id: 10, passage: "<p><br></p>" },
      { id: 5, question_type: 36, exam_id: 8, layer_id: 10 },
    ];
    const groups = practiceQuestionGroups(questions);
    expect(groups.map((group) => group.questions.map((question) => question.id))).toEqual([[1, 2], [3], [4, 5]]);
    // 空壳 passage（纯标签）不能当分组键，要与无文章小题并成整层组
    expect(groups[2].passage).toBe("<p><br></p>");
  });
});

describe("countTodayQuestions", () => {
  /** Naive UTC string, matching what the backend serializes. */
  function naiveUtc(ts) {
    return new Date(ts).toISOString().slice(0, 19);
  }

  it("counts attempts made just now and skips older ones", () => {
    const now = Date.UTC(2026, 11, 10, 12, 7, 30);
    const attempts = [
      { createdAt: naiveUtc(now - 60_000), total: 5 },
      { createdAt: naiveUtc(now - 25 * 3_600_000), total: 9 },
    ];
    expect(countTodayQuestions(attempts, new Date(now))).toBe(5);
  });
});
