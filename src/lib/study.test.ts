import { describe, expect, it } from "vitest";
import {
  calculateExamScore,
  countAnsweredQuestions,
  latestExamAttemptByExam,
} from "./study";

describe("exam helpers", () => {
  it("keeps the newest attempt when attempts are in descending time order", () => {
    const newest = { id: 3, examId: 10 };
    const older = { id: 1, examId: 10 };
    const other = { id: 2, examId: 11 };
    const result = latestExamAttemptByExam([newest, other, older]);

    expect(result.get(10)).toBe(newest);
    expect(result.get(11)).toBe(other);
  });

  it("counts only answers from the current section", () => {
    const questions = [{ id: 2 }, { id: 3 }];
    const answers = { 1: 101, 2: 102 };

    expect(countAnsweredQuestions(questions, answers)).toBe(1);
  });
});

describe("JLPT score estimation", () => {
  const questions = [
    { id: 1, question_type: 21 },
    { id: 2, question_type: 31 },
    { id: 3, question_type: 41 },
  ];
  const answers = questions.map((question) => ({ questionId: question.id, isCorrect: true }));

  it("uses three 60-point sections for N1 through N3", () => {
    const score = calculateExamScore({ level: "N2", answers }, questions);

    expect(score.usesThreeSections).toBe(true);
    expect(score.languageKnowledgeScore).toBe(60);
    expect(score.readingScore).toBe(60);
    expect(score.listeningScore).toBe(60);
    expect(score.totalScore).toBe(180);
    expect(score.passed).toBe(true);
  });

  it("combines language knowledge and reading for N4 and N5", () => {
    const score = calculateExamScore({ level: "N5", answers }, questions);

    expect(score.usesThreeSections).toBe(false);
    expect(score.languageReadingScore).toBe(120);
    expect(score.listeningScore).toBe(60);
    expect(score.totalScore).toBe(180);
    expect(score.passed).toBe(true);
  });

  it("fails when an individual N1-N3 section is below its reference line", () => {
    const score = calculateExamScore({
      level: "N1",
      answers: [
        { questionId: 1, isCorrect: true },
        { questionId: 2, isCorrect: false },
        { questionId: 3, isCorrect: true },
      ],
    }, questions);

    expect(score.totalScore).toBe(120);
    expect(score.readingScore).toBe(0);
    expect(score.passed).toBe(false);
  });
});
