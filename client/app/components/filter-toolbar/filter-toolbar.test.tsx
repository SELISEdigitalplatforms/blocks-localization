import { fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { ClearButton } from "./clear-button/clear-button";
import { DateRange } from "./date-range/date-range";
import { DropdownSearchInput } from "./dropdown-search-input/dropdown-search-input";
import { FilterToolbar } from "./filter-toolbar";
import { MultiSelect } from "./multi-select/multi-select";
import { Radio } from "./radio/radio";
import { ResetButton } from "./reset-button/reset-button";
import { SearchInput } from "./search-input/search-input";
import { SortHeader } from "./sort-header/sort-header";

describe("filter-toolbar/reset-button & clear-button", () => {
  it("ResetButton should invoke onClick", () => {
    const onClick = vi.fn();
    render(<ResetButton onClick={onClick} />);
    fireEvent.click(screen.getByText("Reset"));
    expect(onClick).toHaveBeenCalled();
  });

  it("ClearButton should invoke onClear", () => {
    const onClear = vi.fn();
    render(<ClearButton onClear={onClear} />);
    fireEvent.click(screen.getByText("Clear"));
    expect(onClear).toHaveBeenCalled();
  });
});

describe("filter-toolbar/search-input", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("should debounce onChange while typing", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Find" />);
    fireEvent.change(screen.getByPlaceholderText("Find"), {
      target: { value: "hello" },
    });
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledWith("hello");
  });

  it("should clear immediately", () => {
    const onChange = vi.fn();
    render(<SearchInput value="preset" onChange={onChange} />);
    const clearBtn = screen.getByRole("button", { name: "Clear search" });
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("should cancel a pending search when cleared", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Find" />);

    fireEvent.change(screen.getByPlaceholderText("Find"), { target: { value: "pending" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    act(() => vi.advanceTimersByTime(300));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("filter-toolbar/sort-header", () => {
  it("should toggle sort direction on the active column", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <SortHeader
        id="name"
        label="Name"
        value={{ property: "name", isDescending: false }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Name"));
    expect(onChange).toHaveBeenCalledWith({ property: "name", isDescending: true });
  });

  it("should sort ascending when switching to a new column", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <SortHeader
        id="date"
        label="Date"
        value={{ property: "name", isDescending: true }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Date"));
    expect(onChange).toHaveBeenCalledWith({ property: "date", isDescending: false });
  });
});

describe("filter-toolbar/radio", () => {
  const options = [
    { label: "Alpha", value: "a" },
    { label: "Beta", value: "b" },
  ];

  it("should open and select an option", () => {
    const onChange = vi.fn();
    render(<Radio label="Type" options={options} value="" onChange={onChange} />);
    fireEvent.click(screen.getAllByText("Type")[0]);
    fireEvent.click(screen.getByText("Alpha"));
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("should show a clear action when a value is set", () => {
    const onChange = vi.fn();
    render(<Radio label="Type" options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getAllByText("Type")[0]);
    fireEvent.click(screen.getByText("Clear"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("should filter options by search", () => {
    render(<Radio label="Type" options={options} value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getAllByText("Type")[0]);
    fireEvent.change(screen.getByPlaceholderText("Type"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No results found.")).toBeTruthy();
  });
});

describe("filter-toolbar/multi-select", () => {
  const options = [
    { label: "One", value: "1" },
    { label: "Two", value: "2" },
  ];

  it("should toggle a selection", () => {
    const onChange = vi.fn();
    render(<MultiSelect label="Nums" options={options} value={[]} onChange={onChange} />);
    fireEvent.click(screen.getAllByText("Nums")[0]);
    fireEvent.click(screen.getByRole("option", { name: "One" }));
    expect(onChange).toHaveBeenCalledWith(["1"]);
  });

  it("should deselect an already-selected value", () => {
    const onChange = vi.fn();
    render(<MultiSelect label="Nums" options={options} value={["1"]} onChange={onChange} />);
    fireEvent.click(screen.getAllByText("Nums")[0]);
    fireEvent.click(screen.getByRole("option", { name: "One" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("should clear all selections", () => {
    const onChange = vi.fn();
    render(<MultiSelect label="Nums" options={options} value={["1", "2"]} onChange={onChange} />);
    fireEvent.click(screen.getAllByText("Nums")[0]);
    fireEvent.click(screen.getByRole("option", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("filter-toolbar/date-range", () => {
  it("should open and reset the range", () => {
    const onChange = vi.fn();
    render(<DateRange label="Created" value={null} onChange={onChange} />);
    fireEvent.click(screen.getByText("Created"));
    fireEvent.click(screen.getByText("Reset"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("should apply the current selection", () => {
    const onChange = vi.fn();
    render(
      <DateRange
        label="Created"
        value={{ from: new Date(2026, 0, 1), to: new Date(2026, 0, 5) }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getAllByText("Created")[0]);
    fireEvent.click(screen.getByText("Apply"));
    expect(onChange).toHaveBeenCalled();
  });
});

describe("filter-toolbar/dropdown-search-input", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const options = [
    { label: "Name", value: "name" },
    { label: "Email", value: "email" },
  ];

  it("should debounce text input changes", () => {
    const onChange = vi.fn();
    render(
      <DropdownSearchInput
        value={{ selected: "name", value: "" }}
        onChange={onChange}
        options={options}
        placeholder="Search"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "abc" },
    });
    act(() => vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledWith({ selected: "name", value: "abc" });
  });

  it("should clear the text value immediately", () => {
    const onChange = vi.fn();
    render(
      <DropdownSearchInput
        value={{ selected: "name", value: "typed" }}
        onChange={onChange}
        options={options}
      />,
    );
    fireEvent.click(screen.getAllByRole("button").at(-1)!);
    expect(onChange).toHaveBeenCalledWith({ selected: "name", value: "" });
  });
});

describe("filter-toolbar/FilterToolbar", () => {
  it("should render controls and show reset when values differ from defaults", () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    renderWithProviders(
      <FilterToolbar
        filters={[{ key: "search", type: "SearchInput", label: "Search" }]}
        values={{ search: "abc" }}
        defaultValues={{ search: "" }}
        onChange={onChange}
        onReset={onReset}
      />,
    );
    // Reset button appears because values !== defaultValues.
    expect(screen.getAllByText("Reset").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText("Reset")[0]);
    expect(onReset).toHaveBeenCalledWith({ search: "" });
  });

  it("should hide the reset button when values equal defaults", () => {
    renderWithProviders(
      <FilterToolbar
        filters={[{ key: "search", type: "SearchInput", label: "Search" }]}
        values={{ search: "" }}
        defaultValues={{ search: "" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("Reset")).toBeNull();
  });
});
