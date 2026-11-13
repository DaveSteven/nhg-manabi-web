export function sumActivity(activity, startIndex, endIndex) {
  return activity.slice(startIndex, endIndex).reduce(
    (sum, item) => ({ answered: sum.answered + item.answered, correct: sum.correct + item.correct }),
    { answered: 0, correct: 0 },
  );
}

export function compareRecentActivity(activity, days = 30) {
  const recent = sumActivity(activity, Math.max(0, activity.length - days), activity.length);
  const previous = sumActivity(
    activity,
    Math.max(0, activity.length - days * 2),
    Math.max(0, activity.length - days),
  );
  const accuracy = (period) => period.answered ? period.correct / period.answered * 100 : null;
  const recentAccuracy = accuracy(recent);
  const previousAccuracy = accuracy(previous);
  return {
    recent,
    previous,
    volumeChange: previous.answered
      ? Math.round((recent.answered - previous.answered) / previous.answered * 100)
      : null,
    accuracyChange: recentAccuracy !== null && previousAccuracy !== null
      ? Math.round((recentAccuracy - previousAccuracy) * 10) / 10
      : null,
  };
}

export function heatLevel(answered, maximum) {
  if (!answered || !maximum) return 0;
  return Math.min(4, Math.max(1, Math.ceil(answered / maximum * 4)));
}

export function formatStatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(date);
}

/** T-030 连续周卡：本周（周一→周日）逐日点阵数据。future 日为空位；answered 以 /api/stats/overview 逐日 activity 为准。 */
export interface WeekDot {
  date: string;
  answered: number;
  future: boolean;
}

export function weekDots(activity: { date: string; answered: number }[], today = new Date()): WeekDot[] {
  const answeredByDate = new Map<string, number>(activity.map((item) => [item.date, item.answered]));
  const todayIso = (() => {
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const date = String(today.getDate()).padStart(2, "0");
    return `${today.getFullYear()}-${month}-${date}`;
  })();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    const month = String(day.getMonth() + 1).padStart(2, "0");
    const date = String(day.getDate()).padStart(2, "0");
    const iso = `${day.getFullYear()}-${month}-${date}`;
    return { date: iso, answered: answeredByDate.get(iso) ?? 0, future: iso > todayIso };
  });
}

/** T-013 真题成绩：`/api/stats/exams` 的 snake_case 契约 → 视图模型。 */
export function examPerformanceView(data) {
  return {
    points: (data?.points || []).map((point) => ({
      attemptId: point.attempt_id,
      examId: point.exam_id,
      title: point.title,
      level: point.level,
      correct: point.correct,
      total: point.total,
      score: point.score,
      createdAt: point.created_at,
    })),
    sections: (data?.by_section || []).map((section) => ({
      section: section.section,
      label: section.label,
      correct: section.correct,
      total: section.total,
      accuracy: section.accuracy,
      parts: (section.parts || []).map((part) => ({
        subject: part.subject,
        label: part.label,
        correct: part.correct,
        total: part.total,
        accuracy: part.accuracy,
      })),
    })),
    goal: data?.goal || { enabled: false, goal_pct: null },
  };
}

/** 最近一次真题分数与上一次的差（点数不足 2 或缺分数返回 null），保留一位小数。 */
export function examScoreDelta(points) {
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  const previous = points[points.length - 2];
  if (latest.score === null || previous.score === null) return null;
  return Math.round((latest.score - previous.score) * 10) / 10;
}

/** T-014：attempt 级会话时长（秒）。起点为会话开始/恢复点；无效或 ≤0 返回 undefined（服务端仍钳制）。 */
export function sessionDurationSeconds(startedAt?: string): number | undefined {
  const start = new Date(startedAt || 0).getTime();
  if (!Number.isFinite(start) || start <= 0) return undefined;
  const seconds = Math.round((Date.now() - start) / 1000);
  return seconds > 0 ? seconds : undefined;
}

/** T-014：秒 → 紧凑时长文案（「45 秒」「3 分 20 秒」「1 小时 20 分」）。 */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} 秒`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes < 60) return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours} 小时 ${restMinutes} 分` : `${hours} 小时`;
}

/** T-014 学习效率：`/api/stats/efficiency` 契约 → 视图模型。
    coverage.ratio < 0.5 或无数据时 ready=false，panel 显示「积累中」占位（采集刚上线存量无时长）。 */
export function efficiencyView(data: any) {
  const trend = (data?.speed_trend || []).map((point: any) => ({
    period: point.period,
    avgSeconds: point.avg_seconds,
    answered: point.answered,
  }));
  const distribution = (data?.time_distribution || []).map((item: any) => ({
    kind: item.kind,
    label: item.label,
    seconds: item.seconds,
    pct: item.pct,
  }));
  const coverage = {
    eligible: data?.coverage?.eligible_attempts ?? 0,
    withDuration: data?.coverage?.with_duration ?? 0,
    ratio: data?.coverage?.ratio ?? null,
  };
  const avgSeconds = data?.avg_seconds_per_question ?? null;
  const ready = coverage.withDuration > 0 && avgSeconds !== null && (coverage.ratio === null || coverage.ratio >= 0.5);

  // 速度变化：趋势点对半分，各按 answered 加权平均后比较（正 = 变慢）
  let deltaSeconds: number | null = null;
  const half = Math.floor(trend.length / 2);
  if (trend.length >= 2 && half > 0) {
    const weighted = (rows: any[]) => {
      const total = rows.reduce((sum, row) => sum + (row.answered || 0), 0);
      if (!total) return null;
      const measured = rows.filter((row) => row.avgSeconds !== null && row.avgSeconds !== undefined);
      if (!measured.length) return null;
      const sum = measured.reduce((acc, row) => acc + row.avgSeconds * row.answered, 0);
      return sum / measured.reduce((acc, row) => acc + row.answered, 0);
    };
    const older = weighted(trend.slice(0, half));
    const recent = weighted(trend.slice(half));
    if (older !== null && recent !== null) {
      deltaSeconds = Math.round(recent - older) + 0; // 归一 -0
    }
  }
  const conclusion =
    deltaSeconds === null
      ? "暂无足够的速度对比数据"
      : deltaSeconds <= -1
        ? `比前半期快 ${Math.abs(deltaSeconds)} 秒/题`
        : deltaSeconds >= 1
          ? `比前半期慢 ${deltaSeconds} 秒/题`
          : "答题速度保持稳定";

  return { avgSeconds, trend, distribution, coverage, ready, deltaSeconds, conclusion };
}
