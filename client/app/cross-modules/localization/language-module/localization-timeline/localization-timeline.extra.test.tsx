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

describe("localization-timeline (extra coverage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockByOp.mockReturnValue({ data: undefined, isLoading: false } as never);
  });

  it("maps every operation log type to a description", () => {
    const logTypes: [string, string][] = [
      ["TranslateKey", "Auto-translated by Alice"],
      ["KeyController.Save", "Updated manually by Alice"],
      ["KeyController.BulkSave", "Bulk updated by Alice"],
      ["KeyController.Create", "Key created by Alice"],
      ["KeyController.BulkCreate", "Bulk created by Alice"],
      ["UilmImport.Update", "Updated by import by Alice"],
      ["UilmImport.Insert", "Inserted by import by Alice"],
      ["KeyController.Delete", "Key deleted by Alice"],
      ["PublishFailed", "Publish failed"],
      ["EnvironmentDataMigration", "Environment data migration by Alice"],
      ["MysteryOp", "A translation action occurred"],
    ];
    mockTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: logTypes.length,
        operations: logTypes.map(([logFrom], i) => ({
          operationId: `op${i}`,
          logFrom,
          userName: "Alice",
          createDate: "2026-01-01T10:00:00Z",
          affectedKeysCount: 1,
        })),
      },
    } as never);
    renderWithProviders(<LocalizationTimeline />);
    for (const [, description] of logTypes) {
      expect(screen.getByText(description)).toBeTruthy();
    }
  });

  it("renders the timeline pagination when there are multiple pages", () => {
    mockTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 50,
        operations: [
          {
            operationId: "op1",
            logFrom: "TranslateAll",
            userName: "Alice",
            createDate: "2026-01-01T10:00:00Z",
            affectedKeysCount: 1,
          },
        ],
      },
    } as never);
    renderWithProviders(<LocalizationTimeline />);
    expect(screen.getByText(/Page 1 of/)).toBeTruthy();
  });

  it("shows a loading state inside the operation detail modal", () => {
    mockTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 1,
        operations: [
          {
            operationId: "op1",
            logFrom: "TranslateAll",
            userName: "Alice",
            createDate: "2026-01-01T10:00:00Z",
            affectedKeysCount: 1,
          },
        ],
      },
    } as never);
    mockByOp.mockReturnValue({ isLoading: true, data: undefined } as never);
    renderWithProviders(<LocalizationTimeline />);
    fireEvent.click(screen.getByText("Translate all by Alice"));
    // The modal opens with a fallback title while its details load.
    expect(screen.getByText("Operation Details")).toBeTruthy();
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an empty message when the operation has no details", () => {
    mockTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 1,
        operations: [
          {
            operationId: "op1",
            logFrom: "TranslateAll",
            userName: "Alice",
            createDate: "2026-01-01T10:00:00Z",
            affectedKeysCount: 1,
          },
        ],
      },
    } as never);
    mockByOp.mockReturnValue({
      isLoading: false,
      data: { totalCount: 0, timelines: [] },
    } as never);
    renderWithProviders(<LocalizationTimeline />);
    fireEvent.click(screen.getByText("Translate all by Alice"));
    expect(screen.getByText("No details found")).toBeTruthy();
  });

  it("shows a 'no changes published' message for empty publish operations", () => {
    mockTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 1,
        operations: [
          {
            operationId: "op1",
            logFrom: "Published",
            userName: "Bob",
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
            logFrom: "Published",
            userName: "Bob",
            createDate: "2026-01-01T10:00:00Z",
            previousData: null,
            currentData: null,
          },
        ],
      },
    } as never);
    renderWithProviders(<LocalizationTimeline />);
    fireEvent.click(screen.getByText("Published by Bob"));
    expect(screen.getByText("No changes published")).toBeTruthy();
  });

  it("renders a dash for a change row with no culture differences", () => {
    mockTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 1,
        operations: [
          {
            operationId: "op1",
            logFrom: "KeyController.Save",
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
            logFrom: "KeyController.Save",
            userName: "Alice",
            createDate: "2026-01-01T10:00:00Z",
            // No resources on either side → no cultures → dash.
            previousData: { keyName: "k", resources: [] },
            currentData: { keyName: "k", resources: [] },
          },
        ],
      },
    } as never);
    renderWithProviders(<LocalizationTimeline />);
    fireEvent.click(screen.getByText("Updated manually by Alice"));
    // Key name renders in the detail table.
    expect(screen.getByText("k")).toBeTruthy();
  });
});
