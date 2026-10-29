import { RefObject, useEffect, useState } from "react";
import { GLOSSARY_LIMITS } from "@blocks-localization/constants/glossary-limits";

/**
 * The selection as a glossary name: inner whitespace collapsed, trimmed, 1–200 characters.
 * Undefined when empty or too long (C5).
 */
export const toGlossaryNameFromSelection = (text: string | undefined): string | undefined => {
  const name = (text ?? "").replaceAll(/\s+/g, " ").trim();
  return name && name.length <= GLOSSARY_LIMITS.name ? name : undefined;
};

const isInside = (container: Node, node: Node | null) => !!node && container.contains(node);

/**
 * The text selected inside `ref` (a block of text, or a textarea/input), as a glossary name.
 * A selection that starts or ends outside the element counts as none (C5).
 */
export const useSourceTextSelection = (ref: RefObject<HTMLElement | null>): string | undefined => {
  const [selection, setSelection] = useState<string | undefined>(undefined);

  useEffect(() => {
    const read = () => {
      const element = ref.current;
      if (!element) return;
      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        // A field's own selection; the document selection doesn't cover its value.
        if (document.activeElement !== element) return;
        const { selectionStart, selectionEnd, value } = element;
        setSelection(
          selectionStart !== null && selectionEnd !== null && selectionEnd > selectionStart
            ? toGlossaryNameFromSelection(value.slice(selectionStart, selectionEnd))
            : undefined,
        );
        return;
      }
      const current = document.getSelection();
      const within =
        !!current &&
        !current.isCollapsed &&
        isInside(element, current.anchorNode) &&
        isInside(element, current.focusNode);
      setSelection(within ? toGlossaryNameFromSelection(current.toString()) : undefined);
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, [ref]);

  return selection;
};
