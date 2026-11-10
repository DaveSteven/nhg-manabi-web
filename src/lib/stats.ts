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
