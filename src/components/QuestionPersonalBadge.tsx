import type { QuestionPersonalItem } from "../lib/questionStats";

/**
 * 题目个人维度一行元信息（T-011 / A8.1），如「已练习 5 次 · 我的正确率 80%」。
 * 纯展示：stats 由父级用 useQuestionPersonal 批量拉取后传入；
 * 该题从未作答（不在 map 里）时不渲染（AC1）。
 */
export function QuestionPersonalBadge({ stats, questionId }: {
  stats: Map<number, QuestionPersonalItem> | null;
  questionId: number;
}) {
  const item = stats?.get(questionId);
  if (!item) return null;
  return (
    <span className="question-personal-badge">
      已练习 {item.my_attempts} 次{item.my_accuracy !== null ? `，正确率 ${item.my_accuracy}%` : ""}
    </span>
  );
}
