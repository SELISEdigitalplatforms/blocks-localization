import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { Pagination } from "./pagination";

const renderPagination = (props: { totalCount: number; pageSize: number; options: number[] }) =>
  render(
    <Pagination
      page={0}
      onChange={vi.fn()}
      totalCount={props.totalCount}
      pageSize={props.pageSize}
      pageSizeOptions={props.options}
      onPageSizeChange={vi.fn()}
    />,
  );

describe("Pagination page size select", () => {
  it("shows the plain number when the smallest option already covers all rows", () => {
    renderPagination({ totalCount: 10, pageSize: 10, options: [10] });
    expect(screen.getByRole("combobox").textContent).toContain("10");
    expect(screen.getByRole("combobox").textContent).not.toContain("All");
  });

  it("labels a larger option equal to totalCount as All", () => {
    renderPagination({ totalCount: 25, pageSize: 25, options: [10, 25] });
    expect(screen.getByRole("combobox").textContent).toContain("All (25)");
  });

  it("keeps a value selected when the current pageSize is no longer an option", () => {
    renderPagination({ totalCount: 9, pageSize: 10, options: [10] });
    expect(screen.getByRole("combobox").textContent).toContain("10");

    renderPagination({ totalCount: 24, pageSize: 25, options: [10, 24] });
    expect(screen.getAllByRole("combobox")[1].textContent).toContain("All (24)");
  });
});

describe("Pagination modes", () => {
  it("renders the page text and navigation by default, as before", () => {
    renderPagination({ totalCount: 250, pageSize: 10, options: [10, 30, 50, 100, 250] });
    expect(screen.getByText("Page 1 of 25")).toBeTruthy();
    expect(screen.getByLabelText("Go to next page")).toBeTruthy();
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it("replaces page text and navigation with a live loaded-rows status in all mode", () => {
    render(
      <Pagination
        page={0}
        onChange={vi.fn()}
        totalCount={12345}
        pageSize={12345}
        pageSizeOptions={[10, 30, 50, 100, 12345]}
        onPageSizeChange={vi.fn()}
        mode="all"
        loadedCount={200}
      />,
    );
    const status = screen.getByText(/Showing/);
    expect(status.textContent).toBe(
      `Showing ${(200).toLocaleString()} of ${(12345).toLocaleString()} keys`,
    );
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(screen.queryByText(/Page 1 of/)).toBeNull();
    expect(screen.queryByLabelText("Go to next page")).toBeNull();
    expect(screen.getByRole("combobox").textContent).toContain("All (12345)");
  });
});
