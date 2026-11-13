// T-030 首页考试倒计时（决策 D22）：JLPT 统考日期为前端常量，无后端。
// official=true 为 jlpt.jp 已公布日程（2026-12-06 核对自官方首页，2026-11-13）；
// 之后年份官方尚未公布，按「7 月/12 月第一个周日」规则推算。
// 官方公布后续日程时，把日期移入 ANNOUNCED 并保持 official=true（AC② 硬性项）。
export interface ExamDate {
  date: string; // ISO YYYY-MM-DD
  official: boolean;
}

const ANNOUNCED_EXAM_DATES = ["2026-12-06"];
const PROJECTED_EXAM_DATES = ["2027-07-04", "2027-12-05"];

/** 某年某月的第一个周日（ISO 日期），月份 1-12。 */
export function firstSunday(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month - 1, 1));
  day.setUTCDate(1 + ((7 - day.getUTCDay()) % 7));
  return day.toISOString().slice(0, 10);
}

/** 本地时区的当天 ISO 日期（YYYY-MM-DD）。 */
export function localIsoDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${date}`;
}

/**
 * 接下来 N 次统考（含今天）：先取常量表，耗尽后按推算规则补足。
 * 按日期升序，返回的每次考试 date >= today 的 ISO 日期。
 */
export function upcomingExams(today: Date, count = 3): ExamDate[] {
  const todayIso = localIsoDate(today);
  const listed = [...ANNOUNCED_EXAM_DATES, ...PROJECTED_EXAM_DATES].map(
    (date, index) => ({ date, official: index < ANNOUNCED_EXAM_DATES.length }),
  );
  const upcoming = listed.filter((exam) => exam.date >= todayIso);
  const result: ExamDate[] = upcoming.slice(0, count);
  if (result.length < count) {
    const after = result.length ? result[result.length - 1].date : todayIso;
    result.push(...projectExams(after, count - result.length));
  }
  return result;
}

/** afterIso 之后 N 次推算考试（不含 afterIso 当天），official=false。 */
function projectExams(afterIso: string, count: number): ExamDate[] {
  const projected: ExamDate[] = [];
  const startYear = Number(afterIso.slice(0, 4));
  for (let year = startYear; projected.length < count && year <= startYear + count + 2; year += 1) {
    for (const month of [7, 12]) {
      const date = firstSunday(year, month);
      if (date > afterIso && (!projected.length || date > projected[projected.length - 1].date)) {
        projected.push({ date, official: false });
        if (projected.length >= count) break;
      }
    }
  }
  return projected;
}

/** 「2026年12月（冬季）」；7 月为夏季。 */
export function examLabel(exam: Pick<ExamDate, "date">): string {
  const [, month] = exam.date.split("-");
  const season = month === "12" ? "冬季" : "夏季";
  return `${exam.date.slice(0, 4)}年${Number(month)}月（${season}）`;
}

/** 距考试日整数天数（本地时区），考试当天为 0，过去为负数。 */
export function daysUntilExam(examIso: string, today: Date): number {
  const exam = new Date(`${examIso}T00:00:00`).getTime();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((exam - start) / 86400000);
}

/**
 * 选中的目标考试：localStorage 记忆仍有效（在 upcoming 里）就用记忆值，
 * 否则（无记忆或已过期）默认下一个考试（AC③）。
 */
export function resolveSelectedExam(storedIso: string, exams: ExamDate[]): string {
  return exams.some((exam) => exam.date === storedIso) ? storedIso : (exams[0]?.date ?? "");
}
