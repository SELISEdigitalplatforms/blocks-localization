import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter/data-table-faceted-filter";
import { DateRangeFilter } from "@/components/date-range-filter/date-range-filter";
import QueryProvider, { getQueryClient } from "@/providers/query-provider";
import { useNotificationListener } from "@blocks-utilities/notification";

describe("components/data-table-faceted-filter", () => {
  const makeColumn = (selected: string[] = []) => ({
    getFacetedUniqueValues: () => new Map([["a", 3]]),
    getFilterValue: () => (selected.length ? { types: selected } : undefined),
    setFilterValue: vi.fn(),
  });

  const options = [
    { label: "Alpha", value: "a" },
    { label: "Beta", value: "b" },
  ];

  it("should render the trigger with a title", () => {
    render(
      <DataTableFacetedFilter column={makeColumn() as never} title="Types" options={options} />,
    );
    expect(screen.getAllByText("Types").length).toBeGreaterThan(0);
  });

  it("should select an option and set the column filter", () => {
    const column = makeColumn();
    render(<DataTableFacetedFilter column={column as never} title="Types" options={options} />);
    fireEvent.click(screen.getAllByText("Types")[0]);
    fireEvent.click(screen.getByRole("option", { name: /Alpha/ }));
    expect(column.setFilterValue).toHaveBeenCalledWith(expect.objectContaining({ types: ["a"] }));
  });

  it("should show a Clear action when values are selected", () => {
    const column = makeColumn(["a"]);
    render(<DataTableFacetedFilter column={column as never} title="Types" options={options} />);
    fireEvent.click(screen.getAllByText("Types")[0]);
    fireEvent.click(screen.getByRole("option", { name: "Clear" }));
    expect(column.setFilterValue).toHaveBeenCalledWith(undefined);
  });
});

describe("components/date-range-filter", () => {
  it("should render the title and the selected range", () => {
    render(
      <DateRangeFilter
        title="Created"
        date={{ from: new Date(2026, 0, 1), to: new Date(2026, 0, 5) }}
        onDateChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Created")).toBeTruthy();
    expect(screen.getByText(/01\/01\/2026/)).toBeTruthy();
  });

  it("should render without a range when date is undefined", () => {
    render(<DateRangeFilter title="Created" date={undefined} onDateChange={vi.fn()} />);
    expect(screen.getByText("Created")).toBeTruthy();
  });
});

describe("hooks/use-notification-listener", () => {
  it("should invoke the callback when the event fires", () => {
    const cb = vi.fn();
    renderHook(() => useNotificationListener("evt-x", cb));
    act(() => {
      window.dispatchEvent(new CustomEvent("evt-x", { detail: { value: 1 } }));
    });
    expect(cb).toHaveBeenCalledWith({ value: 1 });
  });

  it("should stop listening after unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useNotificationListener("evt-y", cb));
    unmount();
    act(() => {
      window.dispatchEvent(new CustomEvent("evt-y", { detail: {} }));
    });
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("providers/query-provider", () => {
  it("getQueryClient should be a singleton", () => {
    expect(getQueryClient()).toBe(getQueryClient());
  });

  it("should disable window-focus refetching by default", () => {
    expect(getQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });

  it("should render children inside the provider", () => {
    render(
      <QueryProvider>
        <div>provided child</div>
      </QueryProvider>,
    );
    expect(screen.getByText("provided child")).toBeTruthy();
  });
});
