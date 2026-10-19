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
