import React from "react";
import { Star } from "lucide-react";

/**
 * 星形收藏按钮。favorites.ids 未加载（null）时静默隐藏；
 * source: "textbook"（教材题）| "exam"（真题，含听力）。模考进行中场景不接入本组件。
 */
export default function FavoriteButton({ favorites, source, questionId, className = "" }: {
  favorites: { ids: { textbook: number[]; exam: number[] } | null; toggle: (source: "textbook" | "exam", questionId: number) => void } | null,
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
