import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { makeTestQueryClient } from "@/test-utils/render";
import { toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import * as storageHooks from "@blocks-storage/hooks/use-storage-file";
import ExportKey from "./export-key";

const exportAsync = vi.fn();

vi.mock("@seliseblocks/blocks-kit", () => ({
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
  storageService: { file: { getFileByFileId: vi.fn() } },
}));

const renderExport = () =>
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <Dialog open onOpenChange={() => {}}>
        <ExportKey />
      </Dialog>
    </QueryClientProvider>,
  );

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
      (screen.getByRole("button", { name: "Select file type" }) as HTMLButtonElement)
        .disabled,
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
    expect(
      screen.getByRole("button", { name: "Select file type" }),
    ).toBeTruthy();
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
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Export Started" }),
    );
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
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Download Failed" }),
      ),
    );
  });
});
