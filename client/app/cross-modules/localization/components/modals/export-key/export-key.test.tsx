import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { makeTestQueryClient } from "@/test-utils/render";
import { toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import * as storageHooks from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import { useNotificationListener } from "@blocks-utilities/notification";
import ExportKey from "./export-key";

const exportAsync = vi.fn();

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({
    selectedProject: { tenantId: "t1", itemId: "app-1" },
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@blocks-utilities/notification", () => ({
  useNotificationListener: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguageModule: vi.fn(),
  useGetLanguages: vi.fn(),
  useSaveLanguageKeyUilmExport: vi.fn(),
}));
vi.mock("@blocks-storage/hooks/use-storage-file", () => ({
  useGetPreSignedUrlForUpload: vi.fn(),
  useUploadFile: vi.fn(),
}));
vi.mock("@blocks-storage/services/storage.service", () => ({
  storageService: {
    file: { getFileByFileId: vi.fn(), getFilesDownloadUrl: vi.fn() },
  },
}));

const renderExport = () =>
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <Dialog open onOpenChange={() => {}}>
        <ExportKey />
      </Dialog>
    </QueryClientProvider>,
  );

afterEach(() => vi.useRealTimers());

describe("components/modals/export-key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useGetLanguageModule).mockReturnValue({
      data: [
        { itemId: "m1", moduleName: "UILM" },
        { itemId: "m2", moduleName: "Commission" },
      ],
    } as never);
    vi.mocked(hooks.useGetLanguages).mockReturnValue({
      data: [{ languageCode: "en-US", languageName: "English" }],
    } as never);
    vi.mocked(hooks.useSaveLanguageKeyUilmExport).mockReturnValue({
      mutateAsync: exportAsync,
    } as never);
    vi.mocked(storageHooks.useGetPreSignedUrlForUpload).mockReturnValue({
      mutateAsync: vi.fn(),
    } as never);
    vi.mocked(storageHooks.useUploadFile).mockReturnValue({
      mutateAsync: vi.fn(),
    } as never);
  });

  it("should render step one with the module list", () => {
    renderExport();
    expect(screen.getByText("Export keys")).toBeTruthy();
    expect(screen.getByText("UILM")).toBeTruthy();
    // "Select file type" is disabled until a module is chosen.
    expect(
      (screen.getByRole("button", { name: "Select file type" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("should advance to step two after selecting modules", () => {
    renderExport();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Select file type" }));
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });

  it("should go back to step one", () => {
    renderExport();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Select file type" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Select file type" })).toBeTruthy();
  });

  it("should export once a format is chosen and download confirmed", async () => {
    exportAsync.mockResolvedValue({ isSuccess: true });
    renderExport();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Select file type" }));
    // Confirm the download checkbox to enable Export.
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(exportAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Export Started" }));
  });

  it("should switch the output type before exporting", async () => {
    exportAsync.mockResolvedValue({ isSuccess: true });
    renderExport();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Select file type" }));
    // Choose the Xlsx output type (second radio: Json, Xlsx, Csv).
    fireEvent.click(screen.getAllByRole("radio")[1]);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(exportAsync).toHaveBeenCalled());
    const [payload] = exportAsync.mock.calls[0];
    expect(payload.outputType).toBe(3);
  });

  it("should show a failure toast when export is unsuccessful", async () => {
    exportAsync.mockResolvedValue({ isSuccess: false });
    renderExport();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Select file type" }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Download Failed" })),
    );
  });

  it("should toggle every module with the select-all checkbox", () => {
    renderExport();
    const selectAll = screen.getAllByRole("checkbox")[0];
    fireEvent.click(selectAll);
    fireEvent.click(screen.getByRole("button", { name: "Select file type" }));
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
    // Back and clear the selection again.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(
      (
        screen.getByRole("button", {
          name: "Select file type",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("should reset and apply the date range popover", async () => {
    renderExport();
    fireEvent.click(screen.getByRole("button", { name: "Set date range" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    });
    expect(screen.getAllByRole("grid")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Set date range" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("button", { name: "Set date range" })).toBeTruthy();
  });

  it("should match the date input width and disable future dates", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 7, 12, 12));
    renderExport();

    fireEvent.click(screen.getByRole("button", { name: "Set date range" }));

    const resetButton = await screen.findByRole("button", { name: "Reset" });
    const popoverContent = resetButton.parentElement?.parentElement;
    expect(popoverContent?.className).toContain("w-[var(--radix-popover-trigger-width)]");
    expect(popoverContent?.className).toContain("min-w-0");

    const futureDate = screen.getByRole("gridcell", { name: "13" });
    expect((futureDate as HTMLButtonElement).disabled).toBe(true);
    vi.useRealTimers();
  });

  // The export component registers a notification listener; grab the latest
  // callback so the download-notification flow can be exercised directly.
  const latestNotificationHandler = () => {
    const calls = vi.mocked(useNotificationListener).mock.calls;
    return calls[calls.length - 1][1] as (data: unknown) => Promise<void>;
  };

  const startExport = async () => {
    exportAsync.mockResolvedValue({ isSuccess: true });
    renderExport();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Select file type" }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(exportAsync).toHaveBeenCalled());
  };

  it("should download the exported file when a success notification arrives", async () => {
    vi.mocked(storageService.file.getFilesDownloadUrl).mockResolvedValue({
      url: "https://download/file",
      name: "export.json",
    } as never);
    await startExport();
    vi.mocked(toast).mockClear();

    await latestNotificationHandler()({
      FileId: "file-9",
      DenormalizedPayload: { IsSuccess: true },
    });

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Status" })),
    );
  });

  it("should toast a failure when the notification reports an error", async () => {
    await startExport();
    vi.mocked(toast).mockClear();

    await latestNotificationHandler()({
      DenormalizedPayload: { IsSuccess: false },
    });

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Download Failed" }));
  });

  it("should toast a failure when the notification has no file id", async () => {
    await startExport();
    vi.mocked(toast).mockClear();

    await latestNotificationHandler()("not-valid-json");

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Download Failed" }));
  });

  it("should toast a failure when the download url is missing", async () => {
    vi.mocked(storageService.file.getFilesDownloadUrl).mockResolvedValue({} as never);
    await startExport();
    vi.mocked(toast).mockClear();

    await latestNotificationHandler()(
      JSON.stringify({ fileId: "file-1", denormalizedPayload: { isSuccess: true } }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Download Failed" })),
    );
  });

  it("should toast a failure when the download lookup throws", async () => {
    vi.mocked(storageService.file.getFilesDownloadUrl).mockRejectedValue(new Error("network"));
    await startExport();
    vi.mocked(toast).mockClear();

    await latestNotificationHandler()({ fileId: "file-2" });

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Download Failed" })),
    );
  });

  it("should ignore a notification when no export is pending", async () => {
    renderExport();
    vi.mocked(toast).mockClear();

    await latestNotificationHandler()({ fileId: "file-3" });

    expect(toast).not.toHaveBeenCalled();
  });

  it("should ignore a notification whose correlation id does not match", async () => {
    await startExport();
    vi.mocked(toast).mockClear();

    await latestNotificationHandler()({
      payload: { responseKey: "some-other-correlation-id" },
      fileId: "file-4",
    });

    expect(toast).not.toHaveBeenCalled();
  });
});
