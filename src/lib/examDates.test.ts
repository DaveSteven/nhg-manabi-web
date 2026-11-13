import { describe, expect, it } from "vitest";
import { daysUntilExam, examLabel, firstSunday, localIsoDate, resolveSelectedExam, upcomingExams } from "./examDates";

describe("exam dates", () => {
  it("computes the first Sunday of a month (AC② 推算规则)", () => {
    // 2026-12-01 是周二，第一个周日为 12-06；2027-07-01 是周四，第一个周日为 07-04
    expect(firstSunday(2026, 12)).toBe("2026-12-06");
    expect(firstSunday(2027, 7)).toBe("2027-07-04");
    expect(firstSunday(2027, 12)).toBe("2027-12-05");
  });

  it("lists upcoming exams from announced constants (AC②)", () => {
    // 2026-11-13 当天：官方已公布 2026-12-06 在列表首位
    const exams = upcomingExams(new Date("2026-11-13T12:00:00"));
    expect(exams[0]).toEqual({ date: "2026-12-06", official: true });
    expect(exams.map((exam) => exam.date)).toEqual(["2026-12-06", "2027-07-04", "2027-12-05"]);
  });

  it("includes today's exam and drops past ones", () => {
    const onExamDay = upcomingExams(new Date("2026-12-06T12:00:00"));
    expect(onExamDay[0].date).toBe("2026-12-06");
    const nextYear = upcomingExams(new Date("2027-12-20T12:00:00"));
    // 常量表耗尽后按「7 月/12 月第一个周日」推算兜底
    expect(nextYear.map((exam) => exam.date)).toEqual(["2028-07-02", "2028-12-03", "2029-07-01"]);
  });

  it("labels exams as 夏季/冬季", () => {
    expect(examLabel({ date: "2026-12-06" })).toBe("2026年12月（冬季）");
    expect(examLabel({ date: "2027-07-04" })).toBe("2027年7月（夏季）");
  });

  it("counts days until the exam, with zero on exam day", () => {
    expect(daysUntilExam("2026-12-06", new Date("2026-11-13T15:00:00"))).toBe(23);
    expect(daysUntilExam("2026-12-06", new Date("2026-12-06T08:00:00"))).toBe(0);
    expect(daysUntilExam("2026-12-06", new Date("2026-12-07T08:00:00"))).toBe(-1);
  });

  it("keeps a still-valid stored exam, otherwise falls back to the next one (AC③)", () => {
    const exams = upcomingExams(new Date("2026-11-13T12:00:00"));
    expect(resolveSelectedExam("2027-07-04", exams)).toBe("2027-07-04");
    expect(resolveSelectedExam("", exams)).toBe("2026-12-06");
    // 记忆的考试已过期 → 默认下一个考试
    expect(resolveSelectedExam("2026-07-05", exams)).toBe("2026-12-06");
  });

  it("formats local dates zero-padded", () => {
    expect(localIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
