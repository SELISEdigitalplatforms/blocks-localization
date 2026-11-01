import { Fragment, type ReactNode } from "react";

type SlotRenderer = (children: ReactNode) => ReactNode;

/**
 * Turns a translated string with simple tags into React nodes, so a sentence stays one key.
 * `<b>text</b>` calls `slots.b("text")`; a self-closing `<icon/>` calls `slots.icon(null)`.
 * Text between tags is kept as-is. Unknown tags are shown as plain text.
 */
const TAG_PATTERN = /<(\w+)\/>|<(\w+)>([\s\S]*?)<\/\2>/g;

export function renderRichText(text: string, slots: Record<string, SlotRenderer>): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(TAG_PATTERN)) {
    const tag = match[1] ?? match[2];
    const render = slots[tag];
    if (!render) continue;
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    nodes.push(<Fragment key={`${tag}-${index++}`}>{render(match[3] ?? null)}</Fragment>);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
