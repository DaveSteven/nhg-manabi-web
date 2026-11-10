import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Keyboard, RotateCcw, Trophy, X } from "lucide-react";
import { HtmlInline } from "./Html";
import { useKeyboardHintToast } from "../hooks/useKeyboardAnswer";

export function Progress({ value }) {
  return (
    <div className="progress">
      <span style={{ width: `${value > 0 ? Math.max(4, value) : 0}%` }} />
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

export function FieldInput({ label, value, onChange, ...rest }: any) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} {...rest} />
    </label>
  );
}
