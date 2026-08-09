import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";

// The date-range branch is reached through FilterToolbar's onChange, and driving a
// real calendar widget would test the picker rather than the conversion logic here.
// Stub the toolbar so each case can hand the component an exact from/to pair. This
// lives in its own file because the sibling tests exercise the real toolbar.
vi.mock("@/components/filter-toolbar", () => ({
  FilterToolbar: ({
    onChange,
  }: {
    onChange: (key: string, value: unknown) => void;
  }) => (
    <div>
      <button onClick={() => onChange("created", { from: new Date(2026, 0, 15) })}>from-only</button>
      <button
        onClick={() =>
          onChange("created", { from: new Date(2026, 0, 15), to: new Date(2026, 0, 20) })
        }
      >
        different-days
      </button>
      <button
        onClick={() =>
          onChange("created", { from: new Date(2026, 0, 15), to: new Date(2026, 0, 15) })
        }
      >
        same-day
      </button>
      <button onClick={() => onChange("created", null)}>cleared</button>
    </div>
  ),
}));

import { ExportHistoryFilters } from "./export-history-filters";

describe("language-module/export-history-filters date range", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the start date and leaves the end date empty when only a start is picked", () => {
    const onChange = vi.fn();
    renderWithProviders(<ExportHistoryFilters onChange={onChange} />);

    fireEvent.click(screen.getByText("from-only"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: "2026-01-15T00:00:00.000Z",
        endDate: "",
        pageNumber: 0,
      }),
    );
  });

  it("sends both dates when the range spans different days", () => {
    const onChange = vi.fn();
    renderWithProviders(<ExportHistoryFilters onChange={onChange} />);

    fireEvent.click(screen.getByText("different-days"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: "2026-01-15T00:00:00.000Z",
        endDate: "2026-01-20T00:00:00.000Z",
      }),
    );
  });

  it("drops the end date when the range starts and ends on the same day", () => {
    // A single-day pick would otherwise send an end date equal to the start, which
    // the history query treats as a two-sided range.
    const onChange = vi.fn();
    renderWithProviders(<ExportHistoryFilters onChange={onChange} />);

    fireEvent.click(screen.getByText("same-day"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: "2026-01-15T00:00:00.000Z",
        endDate: "",
      }),
    );
  });

  it("clears both dates when the range is removed", () => {
    const onChange = vi.fn();
    renderWithProviders(<ExportHistoryFilters onChange={onChange} />);

    fireEvent.click(screen.getByText("cleared"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: "", endDate: "" }),
    );
  });

  it("formats month and day with a leading zero", () => {
    // Guards the padStart calls: a naive template would emit 2026-1-5.
    const onChange = vi.fn();
    renderWithProviders(<ExportHistoryFilters onChange={onChange} />);

    fireEvent.click(screen.getByText("from-only"));

    const [call] = onChange.mock.calls;
    expect(call[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
  });
});
