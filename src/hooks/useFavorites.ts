import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFavoriteIds, toggleFavorite, unfavorite } from "../lib/appHelpers";

type FavoriteIds = { textbook: number[]; exam: number[] };

const FAVORITE_IDS_KEY = ["favorite-ids"] as const;

/**
 * 场景级收藏态（T-022 刀三：ids 拉取迁 Query 缓存）；ids 为 null 表示尚未加载，按钮静默隐藏。
 * toggle 乐观更新 Query 缓存，接口失败时回滚。
 * toggleGroup：题组级收藏（T-021/D13）——点亮 = 收藏组内首题（代理 id），点灭 = 移除
 * 组内全部收藏行（兼容 T-008「收藏组内某一小题」的存量行）；ids 缓存结构不变。
 */
export default function useFavorites(token: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: FAVORITE_IDS_KEY,
    queryFn: async (): Promise<FavoriteIds> => {
      const data = await fetchFavoriteIds(token);
      return { textbook: data?.textbook || [], exam: data?.exam || [] };
    },
    enabled: Boolean(token),
    // 乐观更新自行维护，页面间共享同一份缓存，不自动 refetch
    staleTime: Infinity,
  });
  const ids = query.data ?? null;

  const setIds = useCallback((updater: (current: FavoriteIds | null) => FavoriteIds | null) => {
    queryClient.setQueryData<FavoriteIds>(FAVORITE_IDS_KEY, (current) => updater(current ?? null));
  }, [queryClient]);

  const toggle = useCallback((source: "textbook" | "exam", questionId: number) => {
    const current = queryClient.getQueryData<FavoriteIds>(FAVORITE_IDS_KEY);
    if (!current) return;
    const active = current[source].includes(questionId);
    const next: FavoriteIds = active
      ? { ...current, [source]: current[source].filter((id) => id !== questionId) }
      : { ...current, [source]: [...current[source], questionId] };
    setIds(() => next);
    const request = active ? unfavorite(source, questionId, token) : toggleFavorite(source, questionId, token);
    request.catch(() => {
      // 回滚到操作前的状态
      setIds(() => current);
    });
  }, [token, queryClient, setIds]);

  const toggleGroup = useCallback((source: "textbook" | "exam", questionIds: number[]) => {
    const current = queryClient.getQueryData<FavoriteIds>(FAVORITE_IDS_KEY);
    if (!current || !questionIds.length) return;
    const proxyId = questionIds[0];
    const present = questionIds.filter((id) => current[source].includes(id));
    const active = present.length > 0;
    const next: FavoriteIds = active
      ? { ...current, [source]: current[source].filter((id) => !present.includes(id)) }
      : { ...current, [source]: [...current[source], proxyId] };
    setIds(() => next);
    const request = active
      ? Promise.all(present.map((id) => unfavorite(source, id, token)))
      : toggleFavorite(source, proxyId, token);
    request.catch(() => {
      // 回滚到操作前的状态
      setIds(() => current);
    });
  }, [token, queryClient, setIds]);

  return { ids, toggle, toggleGroup };
}
