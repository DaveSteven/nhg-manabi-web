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
