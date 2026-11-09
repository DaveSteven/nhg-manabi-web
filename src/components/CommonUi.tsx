import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, RotateCcw, Trophy, X } from "lucide-react";
import { HtmlInline } from "./Html";

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

export function FieldInput({ label, value, onChange, ...rest }: any) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} {...rest} />
    </label>
  );
}
