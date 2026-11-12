import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFavoriteIds, toggleFavorite, unfavorite } from "../lib/appHelpers";

type FavoriteIds = { textbook: number[]; exam: number[] };

/**
 * 场景级收藏态：进入场景拉一次 ids 存内存；ids 为 null 表示尚未加载，按钮静默隐藏。
 * toggle 乐观更新列表，接口失败时回滚。
 * toggleGroup：题组级收藏（T-021/D13）——点亮 = 收藏组内首题（代理 id），点灭 = 移除
 * 组内全部收藏行（兼容 T-008「收藏组内某一小题」的存量行）；ids 缓存结构不变。
 */
export default function useFavorites(token: string | null) {
  const [ids, setIds] = useState<FavoriteIds | null>(null);
  const idsRef = useRef<FavoriteIds | null>(null);
  useEffect(() => { idsRef.current = ids; }, [ids]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    fetchFavoriteIds(token)
      .then((data) => {
        if (alive) setIds({ textbook: data?.textbook || [], exam: data?.exam || [] });
      })
      .catch(() => {
        // 拉取失败时按空集处理：按钮可见但一律可点（PUT 幂等，不会重复建行）
        if (alive) setIds({ textbook: [], exam: [] });
      });
    return () => { alive = false; };
  }, [token]);

  const toggle = useCallback((source: "textbook" | "exam", questionId: number) => {
    const current = idsRef.current;
    if (!current) return;
    const active = current[source].includes(questionId);
    const next: FavoriteIds = active
      ? { ...current, [source]: current[source].filter((id) => id !== questionId) }
      : { ...current, [source]: [...current[source], questionId] };
    idsRef.current = next;
    setIds(next);
    const request = active ? unfavorite(source, questionId, token) : toggleFavorite(source, questionId, token);
    request.catch(() => {
      // 回滚到操作前的状态
      idsRef.current = current;
      setIds(current);
    });
  }, [token]);

  const toggleGroup = useCallback((source: "textbook" | "exam", questionIds: number[]) => {
    const current = idsRef.current;
    if (!current || !questionIds.length) return;
    const proxyId = questionIds[0];
    const present = questionIds.filter((id) => current[source].includes(id));
    const active = present.length > 0;
    const next: FavoriteIds = active
      ? { ...current, [source]: current[source].filter((id) => !present.includes(id)) }
      : { ...current, [source]: [...current[source], proxyId] };
    idsRef.current = next;
    setIds(next);
    const request = active
      ? Promise.all(present.map((id) => unfavorite(source, id, token)))
      : toggleFavorite(source, proxyId, token);
    request.catch(() => {
      // 回滚到操作前的状态
      idsRef.current = current;
      setIds(current);
    });
  }, [token]);

  return { ids, toggle, toggleGroup };
}
