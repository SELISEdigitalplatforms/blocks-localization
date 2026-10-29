/**
 * Where a glossary "Insert" lands. Each target textarea is bound with `bindTarget(culture)`;
 * its last selection is tracked through `onSelect`/`onBlur` (a collapsed selection is the
 * caret). `insert(value)` replaces that range in the last-focused target, or the first
 * target before any was focused, then focuses it with the caret after the inserted text.
 */
import { FocusEvent, SyntheticEvent, useCallback, useRef, useState } from "react";

import { isNoSpaceCulture } from "@blocks-localization/utils/glossary-text";

interface SelectionRange {
  start: number;
  end: number;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Replaces `range` of `text` with `value`. Without a range (never focused) the value is
 * appended after one space. A space is added on either side where the value would otherwise
 * run into a word ("login" + "SELISE" → "login SELISE"), except in no-space languages.
 * Returns the new text and the caret position after the value.
 */
export const insertAtRange = (
  text: string,
  value: string,
  range?: SelectionRange,
  culture?: string,
): { text: string; caret: number } => {
  const start = range ? Math.max(0, Math.min(range.start, text.length)) : text.length;
  const end = range ? Math.max(start, Math.min(range.end, text.length)) : text.length;
  const before = text.slice(0, start);
  const after = text.slice(end);
  const spaced = !isNoSpaceCulture(culture);
  const joins = (left?: string, right?: string) =>
    spaced && !!left && !!right && WORD_CHAR.test(left) && WORD_CHAR.test(right);
  // At a caret or selection, space only where words would join; when appending (never
  // focused), space after any text that doesn't already end in whitespace.
  const needsLead = range
    ? joins(before.at(-1), value[0])
    : spaced && !!before && !/\s$/.test(before);
  const lead = needsLead ? " " : "";
  const trail = joins(value.at(-1), after[0]) ? " " : "";
  return {
    text: before + lead + value + trail + after,
    caret: before.length + lead.length + value.length,
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
      const result = insertAtRange(
        getValue(culture),
        value,
        rangesRef.current.get(culture),
        culture,
      );
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
