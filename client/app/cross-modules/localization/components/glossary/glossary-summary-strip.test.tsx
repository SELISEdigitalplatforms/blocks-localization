import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGetGlossarySummaryCounts } from "@blocks-localization/hooks/use-language-manager";
import GlossarySummaryStrip from "./glossary-summary-strip";

vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetGlossarySummaryCounts: vi.fn(),
}));

describe("components/glossary/glossary-summary-strip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGetGlossarySummaryCounts).mockReturnValue({
      total: 1280,
      approved: 112,
      draft: 9,
      deprecated: 7,
    });
  });

  it("shows Total, Approved, Draft and Deprecated counts in that order (H18)", () => {
    render(<GlossarySummaryStrip status={undefined} onStatusChange={vi.fn()} />);
    const labels = screen.getAllByRole("button").map((button) => button.textContent);
    expect(labels).toEqual([
      `${(1280).toLocaleString()} terms`,
      "112 approved",
      "9 draft",
      "7 deprecated",
    ]);
  });

  it("marks Total as pressed when no status filter is set", () => {
    render(<GlossarySummaryStrip status={undefined} onStatusChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /terms/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "9 draft" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("marks the active status as pressed", () => {
    render(<GlossarySummaryStrip status="draft" onStatusChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "9 draft" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: /terms/ }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("applies a status filter, and Total clears it", () => {
    const onStatusChange = vi.fn();
    render(<GlossarySummaryStrip status="draft" onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole("button", { name: "112 approved" }));
    expect(onStatusChange).toHaveBeenLastCalledWith("approved");
    fireEvent.click(screen.getByRole("button", { name: /terms/ }));
    expect(onStatusChange).toHaveBeenLastCalledWith(undefined);
  });

  it("shows a dash for a count that hasn't loaded or failed", () => {
    vi.mocked(useGetGlossarySummaryCounts).mockReturnValue({ total: 5 });
    render(<GlossarySummaryStrip status={undefined} onStatusChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "– draft" })).toBeTruthy();
  });
});
