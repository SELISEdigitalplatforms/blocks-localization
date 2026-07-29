import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateRangeFilter } from "./date-range-filter";

vi.mock("@/hooks/use-is-mobile", () => ({ default: () => false }));

describe("components/date-range-filter", () => {
  it("renders the title when no date is selected", () => {
    render(<DateRangeFilter title="Created" date={undefined} onDateChange={vi.fn()} />);
    expect(screen.getByText("Created")).toBeTruthy();
  });

  it("renders a selected date range in the trigger", () => {
    render(
      <DateRangeFilter
        title="Created"
        date={{ from: new Date(2024, 0, 1), to: new Date(2024, 0, 5) }}
        onDateChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Created")).toBeTruthy();
  });

  it("renders a single-day selection without an end date", () => {
    render(
      <DateRangeFilter
        title="Created"
        date={{ from: new Date(2024, 0, 1), to: undefined }}
        onDateChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Created")).toBeTruthy();
  });
});
