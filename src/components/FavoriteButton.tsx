import React from "react";
import { Star } from "lucide-react";

type FavoritesState = {
  ids: { textbook: number[]; exam: number[] } | null;
  toggle: (source: "textbook" | "exam", questionId: number) => void;
  toggleGroup: (source: "textbook" | "exam", questionIds: number[]) => void;
} | null;

/**
 * 星形收藏按钮。favorites.ids 未加载（null）时静默隐藏；
 * source: "textbook"（教材题）| "exam"（真题，含听力）。模考进行中场景不接入本组件。
 */
export default function FavoriteButton({ favorites, source, questionId, className = "" }: {
  favorites: FavoritesState,
  source: "textbook" | "exam",
  questionId: number,
  className?: string,
}) {
  if (!favorites?.ids) return null;
  const active = favorites.ids[source]?.includes(questionId) || false;
  return (
    <button
      className={`favorite-button ${active ? "active" : ""} ${className}`.trim()}
      onClick={() => favorites.toggle(source, questionId)}
      type="button"
      aria-pressed={active}
      aria-label={active ? "取消收藏本题" : "收藏本题"}
      title={active ? "取消收藏" : "收藏本题"}
    >
      <Star size={17} aria-hidden="true" />
    </button>
  );
}

/**
 * 题组级星形收藏按钮（T-021/D13）：一组一个星。点亮 = 组内任一题已收藏；
 * 点亮动作收藏组内首题（代理 id），点灭移除整组收藏行。
 */
export function FavoriteGroupButton({ favorites, source, questionIds, className = "" }: {
  favorites: FavoritesState,
  source: "textbook" | "exam",
  questionIds: number[],
  className?: string,
}) {
  if (!favorites?.ids || !questionIds.length) return null;
  const groupIds = favorites.ids[source] || [];
  const active = questionIds.some((id) => groupIds.includes(id));
  return (
    <button
      className={`favorite-button favorite-group-button ${active ? "active" : ""} ${className}`.trim()}
      onClick={() => favorites.toggleGroup(source, questionIds)}
      type="button"
      aria-pressed={active}
      aria-label={active ? "取消收藏本组" : "收藏本组"}
      title={active ? "取消收藏本组" : "收藏本组"}
    >
      <Star size={17} aria-hidden="true" />
    </button>
  );
}
