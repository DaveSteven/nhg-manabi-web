import React from "react";
import { ChevronDown } from "lucide-react";

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
  return (
    <label className={`ui-select-field${compact ? " compact" : ""}${className ? ` ${className}` : ""}`}>
      {label ? <span className="ui-select-label">{label}</span> : null}
      <span className="ui-select-control">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={ariaLabel || label}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ChevronDown size={17} aria-hidden="true" />
      </span>
    </label>
  );
}
