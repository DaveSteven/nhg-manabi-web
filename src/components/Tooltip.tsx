import React from "react";

interface TooltipProps {
  /** Plain text shown in the bubble (CSS `attr(data-tip)`). */
  tip: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Lightweight CSS-only tooltip (ux plan B6).
 * Appears after a 300ms hover, hides immediately; positioning is pure CSS.
 * Consumers: exam review jump dots, future stats charts (方案二) and ruby annotations.
 */
export function Tooltip({ tip, className = "", children }: TooltipProps) {
  return (
    <span className={`tooltip ${className}`.trim()} data-tip={tip}>
      {children}
    </span>
  );
}
