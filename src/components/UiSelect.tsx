import React, { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type SelectOption = {
  value: string;
  label: string;
};

type UiSelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  ariaLabel?: string;
  compact?: boolean;
  className?: string;
};

export default function UiSelect({
  value,
  options,
  onChange,
  label,
  ariaLabel,
  compact = false,
  className = "",
}: UiSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedOption = options[selectedIndex] || options[0];

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + direction + options.length) % options.length);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  return (
    <div
      ref={rootRef}
      className={`ui-select-field${compact ? " compact" : ""}${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {label ? <span className="ui-select-label">{label}</span> : null}
      <span className="ui-select-control">
        <button
          ref={buttonRef}
          type="button"
          className="ui-select-trigger"
          aria-label={ariaLabel || label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={handleKeyDown}
        >
          <span>{selectedOption?.label || ""}</span>
        </button>
        <ChevronDown size={17} aria-hidden="true" />
        {open ? (
          <div id={listboxId} className="ui-select-menu" role="listbox" aria-label={ariaLabel || label}>
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                tabIndex={-1}
                role="option"
                aria-selected={option.value === value}
                className={`${option.value === value ? "selected" : ""}${index === activeIndex ? " active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {option.value === value ? <Check size={17} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </span>
    </div>
  );
}
