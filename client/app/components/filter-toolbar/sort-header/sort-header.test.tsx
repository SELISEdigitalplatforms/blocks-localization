import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setQueryParams = vi.fn();
let queryParams: Record<string, unknown> = {
  "sort-property": "",
  "sort-isDescending": false,
};

vi.mock("nuqs", () => ({
  useQueryStates: () => [queryParams, setQueryParams],
  parseAsString: { withDefault: (d: string) => d },
  parseAsBoolean: { withDefault: (d: boolean) => d },
}));

import { SortHeader, useSortQueryParams } from "./sort-header";

describe("components/filter-toolbar/sort-header", () => {
  beforeEach(() => {
    setQueryParams.mockReset();
    queryParams = { "sort-property": "", "sort-isDescending": false };
  });

  it("should render the label inside a real button", () => {
    render(
      <SortHeader id="name" label="Name" value={{ property: "", isDescending: false }} onChange={vi.fn()} />,
    );

    // A button rather than a clickable div, so it is keyboard reachable without a key handler.
    expect(screen.getByRole("button", { name: "Name" })).toBeTruthy();
  });

  it("should sort ascending on the first click of an inactive header", () => {
    const onChange = vi.fn();
    render(
      <SortHeader id="name" label="Name" value={{ property: "", isDescending: false }} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));

    expect(onChange).toHaveBeenCalledWith({ property: "name", isDescending: false });
  });

  it("should flip to descending when the active ascending header is clicked", () => {
    const onChange = vi.fn();
    render(
      <SortHeader id="name" label="Name" value={{ property: "name", isDescending: false }} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));

    expect(onChange).toHaveBeenCalledWith({ property: "name", isDescending: true });
  });

  it("should reset to ascending when a different column is active", () => {
    const onChange = vi.fn();
    render(
      <SortHeader id="name" label="Name" value={{ property: "date", isDescending: true }} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));

    expect(onChange).toHaveBeenCalledWith({ property: "name", isDescending: false });
  });

  it("should not let the click reach an enclosing row handler", () => {
    const onRowClick = vi.fn();
    const onChange = vi.fn();
    render(
      // Mirrors real usage: the header sits inside a clickable table-header cell.
      <div data-testid="row" onClick={onRowClick}>
        <SortHeader id="name" label="Name" value={{ property: "", isDescending: false }} onChange={onChange} />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));

    expect(onChange).toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  describe("useSortQueryParams", () => {
    it("should expose the query state as a SortValue", () => {
      queryParams = { "sort-property": "name", "sort-isDescending": true };

      const { result } = renderHook(() => useSortQueryParams({}));

      expect(result.current.sortQueryParams).toEqual({ property: "name", isDescending: true });
    });

    it("should write both sort keys together", () => {
      const { result } = renderHook(() => useSortQueryParams({}));

      result.current.setSortQueryParams({ property: "date", isDescending: true });

      expect(setQueryParams).toHaveBeenCalledTimes(1);
      const updater = setQueryParams.mock.calls[0][0] as () => unknown;
      expect(updater()).toEqual({ "sort-property": "date", "sort-isDescending": true });
    });

    it("should clear the query state on reset", () => {
      const { result } = renderHook(() => useSortQueryParams({}));

      result.current.reset();

      expect(setQueryParams).toHaveBeenCalledWith(null);
    });
  });
});
