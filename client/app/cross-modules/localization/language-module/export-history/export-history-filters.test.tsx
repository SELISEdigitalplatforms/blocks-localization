import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { ExportHistoryFilters } from "./export-history-filters";

describe("language-module/export-history-filters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should render the filter toolbar", () => {
    renderWithProviders(<ExportHistoryFilters onChange={vi.fn()} />);
    expect(screen.getAllByText("Date").length).toBeGreaterThan(0);
  });

  it("should propagate a search change", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    renderWithProviders(<ExportHistoryFilters onChange={onChange} />);
    // FilterToolbar renders both desktop and mobile views, so target the first.
    fireEvent.change(screen.getAllByPlaceholderText("Search...")[0], {
      target: { value: "abc" },
    });
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: "abc" }),
    );
    vi.useRealTimers();
  });

  it("should reset filters", () => {
    const onChange = vi.fn();
    renderWithProviders(<ExportHistoryFilters onChange={onChange} />, {
      searchParams: "?search=abc",
    });
    // Reset button appears because a value differs from defaults.
    fireEvent.click(screen.getAllByText("Reset")[0]);
    expect(onChange).toHaveBeenCalledWith({
      search: "",
      startDate: "",
      endDate: "",
    });
  });
});
