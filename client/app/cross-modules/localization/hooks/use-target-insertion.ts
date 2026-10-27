/**
 * Where a glossary "Insert" lands. Each target textarea is bound with `bindTarget(culture)`;
 * its last selection is tracked through `onSelect`/`onBlur` (a collapsed selection is the
 * caret). `insert(value)` replaces that range in the last-focused target, or the first
 * target before any was focused, then focuses it with the caret after the inserted text.
 */
import { FocusEvent, SyntheticEvent, useCallback, useRef, useState } from "react";

interface SelectionRange {
  start: number;
  end: number;
}

/**
 * Replaces `range` of `text` with `value`. Without a range (never focused) the value is
 * appended after one space. Returns the new text and the caret position after the value.
 */
export const insertAtRange = (
  text: string,
  value: string,
  range?: SelectionRange,
): { text: string; caret: number } => {
  if (!range) {
    const prefix = text && !/\s$/.test(text) ? `${text} ` : text;
    return { text: prefix + value, caret: prefix.length + value.length };
  }
  const start = Math.max(0, Math.min(range.start, text.length));
  const end = Math.max(start, Math.min(range.end, text.length));
  return {
    text: text.slice(0, start) + value + text.slice(end),
    caret: start + value.length,
  };
};

interface UseTargetInsertionOptions {
  /** Target cultures in project order; the first is used before any target is focused. */
  cultures: string[];
  getValue: (culture: string) => string;
  setValue: (culture: string, value: string) => void;
}

export const useTargetInsertion = ({ cultures, getValue, setValue }: UseTargetInsertionOptions) => {
  const elementsRef = useRef(new Map<string, HTMLTextAreaElement>());
  const rangesRef = useRef(new Map<string, SelectionRange>());
  const [lastFocused, setLastFocused] = useState<string | null>(null);

  const targetCulture =
    lastFocused && cultures.includes(lastFocused) ? lastFocused : (cultures[0] ?? "");

  const bindTarget = useCallback((culture: string) => {
    const remember = (element: HTMLTextAreaElement) =>
      rangesRef.current.set(culture, {
        start: element.selectionStart ?? element.value.length,
        end: element.selectionEnd ?? element.value.length,
      });
    return {
      ref: (element: HTMLTextAreaElement | null) => {
        if (element) elementsRef.current.set(culture, element);
        else elementsRef.current.delete(culture);
      },
      onFocus: () => setLastFocused(culture),
      onSelect: (event: SyntheticEvent<HTMLTextAreaElement>) => remember(event.currentTarget),
      onBlur: (event: FocusEvent<HTMLTextAreaElement>) => remember(event.currentTarget),
    };
  }, []);

  const insert = useCallback(
    (value: string) => {
      const culture = targetCulture;
      if (!culture) return;
      const result = insertAtRange(getValue(culture), value, rangesRef.current.get(culture));
      setValue(culture, result.text);
      rangesRef.current.set(culture, { start: result.caret, end: result.caret });
      const element = elementsRef.current.get(culture);
      if (!element) return;
      element.focus();
      // After React has written the new value, which would otherwise move the caret to the end.
      requestAnimationFrame(() => element.setSelectionRange(result.caret, result.caret));
    },
    [getValue, setValue, targetCulture],
  );

  return { bindTarget, insert, targetCulture };
};
