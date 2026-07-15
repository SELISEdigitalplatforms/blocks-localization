import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { useGetExportHistory } from "@blocks-localization/hooks/use-language-manager";
import { useGetFilesDownload } from "@blocks-storage/hooks/use-storage-file";
import { ExportHistory } from "./export-history";

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetExportHistory: vi.fn(),
}));
vi.mock("@blocks-storage/hooks/use-storage-file", () => ({
  useGetFilesDownload: vi.fn(),
}));
vi.mock("./export-history-filters", () => ({
  ExportHistoryFilters: () => null,
}));

const mockHistory = vi.mocked(useGetExportHistory);
const mockDownload = vi.mocked(useGetFilesDownload);

describe("language-module/export-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownload.mockReturnValue({ refetch: vi.fn() } as never);
  });

  it("should render skeletons while loading", () => {
    mockHistory.mockReturnValue({ isLoading: true, data: undefined } as never);
    const { container } = renderWithProviders(<ExportHistory />, {
      route: "/app/abc/services/language/export-history",
    });
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("should render an empty state", () => {
    mockHistory.mockReturnValue({
      isLoading: false,
      data: { totalCount: 0, uilmExportedFiles: [] },
    } as never);
    renderWithProviders(<ExportHistory />, {
      route: "/app/abc/services/language/export-history",
    });
    expect(screen.getByText("No Data Found")).toBeTruthy();
  });

  it("should render exported file rows and trigger download", async () => {
    const refetch = vi.fn().mockResolvedValue({
      data: { url: "https://file", name: "export.json" },
    });
    mockDownload.mockReturnValue({ refetch } as never);
    mockHistory.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 1,
        uilmExportedFiles: [
          { fileId: "f1", fileName: "export.json", createDate: "2026-01-01" },
        ],
      },
    } as never);
    renderWithProviders(<ExportHistory />, {
      route: "/app/abc/services/language/export-history",
    });
    expect(screen.getByText("export.json")).toBeTruthy();
    // Click the download button (the last button in the row).
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });
});
