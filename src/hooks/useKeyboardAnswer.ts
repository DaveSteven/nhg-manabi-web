import { useEffect, useState } from "react";

interface KeyboardAnswerOptions {
  /** Bind the listener only while the answer view is active (default true). */
  active?: boolean;
  /** Number of selectable options; digit keys 1..optionCount trigger onNumber. */
  optionCount?: number;
  /** Called with a zero-based option index when the user presses 1..optionCount. */
  onNumber?: (index: number) => void;
  /** Called on Enter/Space: check answer, or advance when already checked. */
  onAdvance?: () => void;
  /** Called on Escape: open the pause/exit confirmation. */
  onExit?: () => void;
  /** Called on "?": toggle the shortcut cheat sheet. */
  onHelp?: () => void;
  /** Called on ← (e.g. previous question in exam review). */
  onPrev?: () => void;
  /** Called on → (e.g. next question in exam review). */
  onNext?: () => void;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || !element.tagName) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) || element.isContentEditable;
}

/**
 * Keyboard-first answering for quiz/exam views (ux plan B3).
 * Keys: 1~optionCount pick an option, Enter/Space check/advance, Esc exit confirm, ? help, ←/→ prev/next.
 * Skips events from typing targets and never double-fires on focused buttons.
 */
export function useKeyboardAnswer({
  active = true,
  optionCount = 0,
  onNumber,
  onAdvance,
  onExit,
  onHelp,
  onPrev,
  onNext,
}: KeyboardAnswerOptions) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "?") {
        event.preventDefault();
        onHelp?.();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onExit?.();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        // Let a focused button handle its own activation to avoid double firing.
        if ((event.target as HTMLElement | null)?.tagName === "BUTTON") return;
        if (event.repeat) return;
        event.preventDefault();
        onAdvance?.();
        return;
      }
      if (event.key === "ArrowLeft") {
        if (event.repeat) return;
        event.preventDefault();
        onPrev?.();
        return;
      }
      if (event.key === "ArrowRight") {
        if (event.repeat) return;
        event.preventDefault();
        onNext?.();
        return;
      }
      const digit = Number(event.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= optionCount) {
        if (event.repeat) return;
        event.preventDefault();
        onNumber?.(digit - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, optionCount, onNumber, onAdvance, onExit, onHelp, onPrev, onNext]);
}

const KEYBOARD_HINT_SEEN_KEY = "japanese-study-keyboard-hint-seen";

export function markKeyboardHintSeen() {
  localStorage.setItem(KEYBOARD_HINT_SEEN_KEY, "1");
}

/** One-time "keyboard supported" toast state per browser (ux plan B3). */
export function useKeyboardHintToast(): [boolean, () => void] {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (localStorage.getItem(KEYBOARD_HINT_SEEN_KEY)) return undefined;
    setShow(true);
    const timer = window.setTimeout(() => {
      markKeyboardHintSeen();
      setShow(false);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);
  const dismiss = () => {
    markKeyboardHintSeen();
    setShow(false);
  };
  return [show, dismiss];
}
