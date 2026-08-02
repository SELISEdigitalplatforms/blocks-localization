import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import {
  useGetLocalizationTimeline,
  useGetTimelineByOperationId,
} from "@blocks-localization/hooks/use-language-manager";
import LocalizationTimeline from "./localization-timeline";

vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLocalizationTimeline: vi.fn(),
  useGetTimelineByOperationId: vi.fn(),
}));

const mockTimeline = vi.mocked(useGetLocalizationTimeline);
const mockByOp = vi.mocked(useGetTimelineByOperationId);

describe("language-module/localization-timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockByOp.mockReturnValue({ data: undefined, isLoading: false } as never);
  });

  it("should render skeletons while loading", () => {
    mockTimeline.mockReturnValue({ isLoading: true, data: undefined } as never);
    const { container } = renderWithProviders(<LocalizationTimeline />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("should render an empty state", () => {
    mockTimeline.mockReturnValue({
      isLoading: false,
      data: { totalCount: 0, operations: [] },
    } as never);
    renderWithProviders(<LocalizationTimeline />);
    expect(screen.getByText("No history found.")).toBeTruthy();
  });

  it("should map operation log types to descriptions", () => {
    mockTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 2,
        operations: [
          {
            operationId: "op1",
            logFrom: "TranslateAll",
            userName: "Alice",
            createDate: "2026-01-01T10:00:00Z",
            affectedKeysCount: 3,
          },
          {
            operationId: "op2",
            logFrom: "Published",
            userName: "Bob",
            createDate: "2026-01-02T10:00:00Z",
            affectedKeysCount: 1,
          },
        ],
      },
    } as never);
    renderWithProviders(<LocalizationTimeline />);
    expect(screen.getByText("Translate all by Alice")).toBeTruthy();
    expect(screen.getByText("Published by Bob")).toBeTruthy();
    // affectedKeysCount > 1 shows a badge.
    expect(screen.getByText("3 keys")).toBeTruthy();
  });

  it("should open the operation detail modal on row click", () => {
    mockTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 1,
        operations: [
          {
            operationId: "op1",
            logFrom: "Rollback",
            userName: "Alice",
            createDate: "2026-01-01T10:00:00Z",
            affectedKeysCount: 1,
          },
        ],
      },
    } as never);
    mockByOp.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 1,
        timelines: [
          {
            itemId: "t1",
            logFrom: "Rollback",
            userName: "Alice",
            createDate: "2026-01-01T10:00:00Z",
            previousData: { keyName: "k", resources: [{ culture: "en-US", value: "Old" }] },
            currentData: { keyName: "k", resources: [{ culture: "en-US", value: "New" }] },
          },
        ],
      },
    } as never);
    renderWithProviders(<LocalizationTimeline />);
    fireEvent.click(screen.getByText("Rolled back by Alice"));
    // The detail modal renders the diff (Old → New).
    expect(screen.getByText("Old")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
  });

  it("should accept a custom card title and description", () => {
    mockTimeline.mockReturnValue({
      isLoading: false,
      data: { totalCount: 0, operations: [] },
    } as never);
    renderWithProviders(
      <LocalizationTimeline
        timelineQuery={{}}
        cardTitle="Activity Log"
        cardDescription="Everything"
      />,
    );
    expect(screen.getByText("Activity Log")).toBeTruthy();
    expect(screen.getByText("Everything")).toBeTruthy();
  });

  it.each([["Enter"], [" "]])("should open the operation detail modal when %s is pressed on a row", (key) => {
    mockTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 1,
        operations: [
          {
            operationId: "op1",
            logFrom: "Rollback",
            userName: "Alice",
            createDate: "2026-01-01T10:00:00Z",
            affectedKeysCount: 1,
          },
        ],
      },
    } as never);
    mockByOp.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 1,
        timelines: [
          {
            itemId: "t1",
            logFrom: "Rollback",
            userName: "Alice",
            createDate: "2026-01-01T10:00:00Z",
            previousData: { keyName: "k", resources: [{ culture: "en-US", value: "Old" }] },
            currentData: { keyName: "k", resources: [{ culture: "en-US", value: "New" }] },
          },
        ],
      },
    } as never);
    renderWithProviders(<LocalizationTimeline />);

    const row = screen.getByText("Rolled back by Alice").closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(row, { key });

    expect(screen.getByText("Old")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
  });
});
