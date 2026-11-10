import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Keyboard, RotateCcw, Trophy, X } from "lucide-react";
import { HtmlInline } from "./Html";
import { useKeyboardHintToast } from "../hooks/useKeyboardAnswer";

export function Progress({ value }) {
  return (
    <div className="progress">
      <span
        className={value >= 100 ? "complete" : ""}
        style={{ width: `${value > 0 ? Math.max(4, value) : 0}%` }}
      />
    </div>
  );
}

/** `.quiz-header` with the standard back button (or link, via `to`); children render after it. */
export function PageHeader({ onBack, to, label = "返回", className = "", children }: { onBack?: () => void; to?: string; label?: string; className?: string; children?: React.ReactNode }) {
  const icon = <ArrowLeft size={22} />;
  return (
    <header className={`quiz-header ${className}`.trim()}>
      {to !== undefined
        ? <Link className="icon-button" aria-label={label} to={to}>{icon}</Link>
        : <button className="icon-button" onClick={onBack} type="button" aria-label={label}>{icon}</button>}
      {children}
    </header>
  );
}

/** Eyebrow + title (+ optional subtitle) block used in page headers. */
export function TitleBlock({ eyebrow, title, subtitle = null, className = "" }: { eyebrow: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

export function EmptyState({ title, text }) {
  return (
    <div className="empty-books">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

export function OptionButton({ index, option, className = "", children = null, ...rest }: any) {
  return (
    <button className={`option-button ${className}`.trim()} type="button" {...rest}>
      <span className="option-letter">{index + 1}</span>
      <span><HtmlInline html={option.text} /></span>
      {children}
    </button>
  );
}

export function ReviewOptions({ options, questionId, chosenOptionId, correctOptionId, label }) {
  return (
    <section className="review-options" aria-label={label}>
      {options.map((option, i) => {
        const chosen = chosenOptionId === option.id;
        const correct = correctOptionId === option.id;
        const state = correct ? (chosen ? "correct chosen-correct" : "correct") : chosen ? "chosen-wrong" : "";
        return (
          <div className={`review-option ${state}`.trim()} key={`${questionId}-${option.id}`}>
            <span className="review-option-number">{i + 1}</span>
            <span className="review-option-text"><HtmlInline html={option.text} /></span>
          </div>
        );
      })}
    </section>
  );
}

export function ReviewMark({ ok }: { ok: boolean }) {
  return <div className={`review-mark ${ok ? "right" : "miss"}`}>{ok ? <Check size={18} /> : <X size={18} />}</div>;
}

export function ResultScore({ score, children }) {
  return (
    <div className="result-score">
      <Trophy size={54} />
      <h1>{score}%</h1>
      <p>{children}</p>
    </div>
  );
}

export function ResultActions({ onRepeat, repeatLabel, onLibrary, libraryLabel }) {
  return (
    <div className="result-actions">
      <button className="primary-button" onClick={onRepeat} type="button"><RotateCcw size={20} />{repeatLabel}</button>
      <button className="secondary-button" onClick={onLibrary} type="button">{libraryLabel}</button>
    </div>
  );
}

/** Light modal layer used for the shortcut cheat sheet and exit confirmation. */
export function ModalOverlay({ title, onClose, children }: { title: string; onClose?: () => void; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!onClose) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const QUIZ_SHORTCUT_ROWS: Array<[string, string]> = [
  ["1 ~ 4", "选择对应选项"],
  ["Enter / Space", "检查答案，再看下一题"],
  ["Esc", "暂停 / 退出练习"],
  ["?", "显示快捷键速查"],
];

export function ShortcutHelp({ rows = QUIZ_SHORTCUT_ROWS }: { rows?: Array<[string, string]> }) {
  return (
    <>
      <div className="shortcut-rows">
        {rows.map(([keys, label]) => (
          <div key={keys}><kbd>{keys}</kbd><span>{label}</span></div>
        ))}
      </div>
      <p className="modal-footnote">输入框聚焦时快捷键自动失效。</p>
    </>
  );
}

/** One-time hint toast shown on answer pages until the user has seen keyboard support. */
export function KeyboardToast({ suppress = false }: { suppress?: boolean }) {
  const [show, dismiss] = useKeyboardHintToast();
  useEffect(() => {
    if (suppress) dismiss();
  }, [suppress, dismiss]);
  if (!show) return null;
  return (
    <div className="key-toast" role="status">
      <Keyboard size={18} />
      <span>支持键盘操作，按 <kbd className="kbd-hint">?</kbd> 查看速查</span>
    </div>
  );
}

/** Sakura petal rain for reward moments (ux plan B5). "light" = subtle result-page drift, "full" = celebration. */
export function PetalFall({ variant = "full", seconds = 6 }: { variant?: "light" | "full"; seconds?: number }) {
  const [expired, setExpired] = useState(false);
  const petals = useMemo(() => Array.from({ length: variant === "full" ? 26 : 8 }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 2.2,
    duration: 3.8 + Math.random() * 3.6,
    size: 9 + Math.random() * 9,
    drift: -60 + Math.random() * 120,
  })), [variant]);

  useEffect(() => {
    const timer = window.setTimeout(() => setExpired(true), seconds * 1000 + 2500);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  if (expired) return null;
  return (
    <div className={`petal-fall ${variant}`.trim()} aria-hidden="true">
      {petals.map((petal, index) => (
        <span
          key={index}
          style={{
            left: `${petal.left}%`,
            width: petal.size,
            height: petal.size,
            animationDelay: `${petal.delay}s`,
            animationDuration: `${petal.duration}s`,
            "--drift": `${petal.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/** Today's practice progress ring (ux plan B5); goal comes from localStorage. */
export function DailyRing({ value, goal }: { value: number; goal: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const ratio = goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <svg className="daily-ring" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`今日 ${value} / ${goal} 题`}>
      <circle className="daily-ring-track" cx="32" cy="32" r={radius} />
      <circle
        className="daily-ring-value"
        cx="32"
        cy="32"
        r={radius}
        strokeDasharray={`${(circumference * ratio).toFixed(1)} ${circumference.toFixed(1)}`}
        transform="rotate(-90 32 32)"
      />
      <text className="daily-ring-text" x="32" y="37" textAnchor="middle">{Math.round(ratio * 100)}%</text>
    </svg>
  );
}

/** Square seal mark (方案一 U3): sakura-red rounded square with a serif character. */
export function SealMark({ char = "学", size = 44 }: { char?: string; size?: number }) {
  return (
    <span
      className="seal-mark"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      aria-hidden="true"
    >
      {char}
    </span>
  );
}

/** Small sakura blossom SVG (方案一 U4 material); page integration lands with 方案二 streak data. */
export function SakuraBadge({ size = 18, title = "连续学习" }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title} className="sakura-badge">
      <title>{title}</title>
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="12"
          cy="6.4"
          rx="3.4"
          ry="5"
          fill="var(--sakura)"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="2.2" fill="var(--sakura-dark)" />
    </svg>
  );
}

export function FieldInput({ label, value, onChange, ...rest }: any) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} {...rest} />
    </label>
  );
}
