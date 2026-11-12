import type { QuestionPersonalItem } from "../lib/questionStats";

/**
 * 题目个人维度一行元信息（T-011 / A8.1），如「已练习 5 次，正确率 80%」。
 * 纯展示：stats 由父级用 useQuestionPersonal 批量拉取后传入；
 * 该题从未作答（不在 map 里）时不渲染（AC1）。
 * 数字上色：次数/正确率用樱墨强调；正确率按表现分色（≥80% 松绿、<60% 绯红，其余樱墨）。
 */
export function QuestionPersonalBadge({ stats, questionId }: {
  stats: Map<number, QuestionPersonalItem> | null;
  questionId: number;
}) {
  const item = stats?.get(questionId);
  if (!item) return null;
  const accuracyTone = item.my_accuracy === null ? "" : item.my_accuracy >= 80 ? " good" : item.my_accuracy < 60 ? " low" : "";
  return (
    <span className="question-personal-badge">
      已练习 <b className="personal-num">{item.my_attempts}</b> 次
      {item.my_accuracy !== null && (
        <>，正确率 <b className={`personal-num${accuracyTone}`}>{item.my_accuracy}%</b></>
      )}
    </span>
  );
}
