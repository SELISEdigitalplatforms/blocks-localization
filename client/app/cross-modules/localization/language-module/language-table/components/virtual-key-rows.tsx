import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import type { Row } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import type { IBlocksLanguageKey } from "@blocks-localization/models/language";
import { TABLE_ROW_HEIGHT_ESTIMATE } from "../language-table.utils";

/** Ask for the next chunk once the last visible row is this close to the end of the loaded rows. */
const LOAD_AHEAD_ROWS = 20;
const OVERSCAN_ROWS = 10;

interface VirtualKeyRowsProps {
  rows: Row<IBlocksLanguageKey>[];
  /** The table viewport, which scrolls in the All view. */
  scrollElementRef: RefObject<HTMLDivElement | null>;
  headerRef: RefObject<HTMLTableSectionElement | null>;
  headerRowCount: number;
  colSpan: number;
  renderKeyRow: (row: Row<IBlocksLanguageKey>, ariaRowIndex: number) => ReactNode;
  /**
   * Cursor (or, under the duplicates filter, page number) of the oldest chunk still loaded: set once
   * earlier chunks have been evicted.
   */
  headCursor: string | number | null | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onLoadMore: () => void;
  onBackToTop: () => void;
  /** Shown in place of the loader when the last chunk request failed. */
  loadError: ReactNode;
}

/**
 * The All view's table bodies: only the rows in view (plus overscan) are mounted, between spacer
 * rows that stand in for the rest. Each key gets its own <tbody> so its row and expanded details
 * are measured as one item. Loaded lazily, so paged mode never pays for the virtualizer.
 */
export default function VirtualKeyRows({
  rows,
  scrollElementRef,
  headerRef,
  headerRowCount,
  colSpan,
  renderKeyRow,
  headCursor,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  onLoadMore,
  onBackToTop,
  loadError,
}: Readonly<VirtualKeyRowsProps>) {
  "use no memo";

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => TABLE_ROW_HEIGHT_ESTIMATE,
    overscan: OVERSCAN_ROWS,
    // Rows start below the header inside the scroll container.
    scrollMargin: headerRef.current?.offsetHeight ?? 0,
    getItemKey: (index) => rows[index]?.id ?? index,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const { scrollMargin } = rowVirtualizer.options;
  const paddingTop = virtualRows.length ? virtualRows[0].start - scrollMargin : 0;
  const paddingBottom = virtualRows.length
    ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1].end - scrollMargin)
    : 0;
  const lastVisibleRowIndex = rowVirtualizer.range?.endIndex ?? -1;

  // A failed chunk waits for Retry instead of being re-requested on every scroll.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    if (lastVisibleRowIndex >= rows.length - LOAD_AHEAD_ROWS) onLoadMore();
  }, [
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    lastVisibleRowIndex,
    rows.length,
    onLoadMore,
  ]);

  // Evicting the oldest chunk shifts every row up; scroll so the row the user was looking at stays put.
  const firstVisibleRowId = rows[rowVirtualizer.range?.startIndex ?? -1]?.id;
  const anchorRef = useRef({ headCursor, rowId: firstVisibleRowId });
  useLayoutEffect(() => {
    const previous = anchorRef.current;
    anchorRef.current = { headCursor, rowId: firstVisibleRowId };
    if (headCursor == null || previous.headCursor === headCursor) return;
    const anchorIndex = rows.findIndex((row) => row.id === previous.rowId);
    if (anchorIndex >= 0) rowVirtualizer.scrollToIndex(anchorIndex, { align: "start" });
  });

  return (
    <>
      {headCursor != null && (
        <tbody>
          <tr>
            <td colSpan={colSpan} className="py-2 text-center">
              <Button variant="outline" size="sm" onClick={onBackToTop}>
                Back to top
              </Button>
            </td>
          </tr>
        </tbody>
      )}
      {paddingTop > 0 && (
        <tbody aria-hidden="true">
          <tr style={{ height: `${paddingTop}px` }} />
        </tbody>
      )}
      {virtualRows.map((virtualRow) => (
        <tbody
          key={virtualRow.key}
          ref={rowVirtualizer.measureElement}
          data-index={virtualRow.index}
        >
          {renderKeyRow(rows[virtualRow.index], headerRowCount + virtualRow.index + 1)}
        </tbody>
      ))}
      {paddingBottom > 0 && (
        <tbody aria-hidden="true">
          <tr style={{ height: `${paddingBottom}px` }} />
        </tbody>
      )}
      {isFetchingNextPage && (
        <tbody>
          <tr>
            <td colSpan={colSpan} className="py-3">
              <div className="flex items-center justify-center gap-2 text-sm text-medium-emphasis">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading more keys…
              </div>
            </td>
          </tr>
        </tbody>
      )}
      {isFetchNextPageError && !isFetchingNextPage && (
        <tbody>
          <tr>
            <td colSpan={colSpan} className="py-3">
              {loadError}
            </td>
          </tr>
        </tbody>
      )}
    </>
  );
}
