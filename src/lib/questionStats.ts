import { useEffect, useState } from "react";
import { api } from "./study";

/**
 * T-011 题目统计个人维度：每题「我的练习次数 / 我的正确率」。
 * 批量端点 GET /api/stats/question-personal?source=...&ids=...（单次上限 200）。
 * 只返回作答过 ≥1 次的题；未作答的 id 不在响应里，展示层按缺失隐藏（AC1）。
 */

export type QuestionSource = "question" | "exam_question";

export interface QuestionPersonalItem {
  my_attempts: number;
  my_correct: number;
  my_accuracy: number | null;
}

const MAX_IDS_PER_REQUEST = 200;

// 进程内缓存：token+source → question_id → 个人维度。
// 练习页与回顾页对同一批题共享缓存，切换题目/重进页面不重复请求。
const cache = new Map<string, Map<number, QuestionPersonalItem>>();

function cacheKey(token: string, source: QuestionSource) {
  return `${token}:${source}`;
}

export async function fetchQuestionPersonal(
  source: QuestionSource,
  questionIds: Array<number | string>,
  token: string,
): Promise<Map<number, QuestionPersonalItem>> {
  const key = cacheKey(token, source);
  let cached = cache.get(key);
  if (!cached) {
    cached = new Map();
    cache.set(key, cached);
  }
  const settled = cached;
  const missing = [...new Set(questionIds.map(Number))].filter((id) => !settled.has(id));
  for (let start = 0; start < missing.length; start += MAX_IDS_PER_REQUEST) {
    const chunk = missing.slice(start, start + MAX_IDS_PER_REQUEST);
    const res = await api(
      `/api/stats/question-personal?source=${source}&ids=${chunk.join(",")}`,
      {},
      token,
    );
    for (const [id, item] of Object.entries(res.items as Record<string, QuestionPersonalItem>)) {
      settled.set(Number(id), item);
    }
  }
  return settled;
}

/** 练习/回顾场景批量获取个人维度；未登录（无 token）或空列表时不发请求，返回 null。 */
export function useQuestionPersonal(
  source: QuestionSource,
  questionIds: Array<number | string>,
  token: string | null,
) {
  // ids 只关心集合本身：排序后拼接作为依赖，避免父组件每次渲染新建数组导致反复请求。
  const idsKey = [...new Set(questionIds.map(Number))].sort((a, b) => a - b).join(",");
  const [stats, setStats] = useState<Map<number, QuestionPersonalItem> | null>(null);

  useEffect(() => {
    if (!token || !idsKey) return undefined;
    let cancelled = false;
    fetchQuestionPersonal(source, idsKey.split(",").map(Number), token)
      .then((map) => {
        if (!cancelled) setStats(new Map(map));
      })
      .catch(() => {
        // 个人维度是增强信息，加载失败不打扰练习/回顾主流程
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, idsKey, token]);

  return stats;
}
