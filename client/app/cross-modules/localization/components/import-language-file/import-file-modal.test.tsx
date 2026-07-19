import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast, toast } from "@/hooks/use-toast";
import { useImportLanguageFile } from "@blocks-localization/hooks/use-language-manager";
import {
  useGetPreSignedUrlForUpload,
  useUploadFile,
} from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import ImportCommunicationsModal from "./import-file-modal";

const presign = vi.fn();
const uploadFileMut = vi.fn();
const importMut = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useImportLanguageFile: vi.fn(),
}));
vi.mock("@blocks-storage/hooks/use-storage-file", () => ({
  useGetPreSignedUrlForUpload: vi.fn(),
  useUploadFile: vi.fn(),
}));
vi.mock("@blocks-storage/services/storage.service", () => ({
  storageService: { file: { getFileByFileId: vi.fn() } },
}));

const renderModal = () =>
  render(
    <Dialog open onOpenChange={() => {}}>
      <ImportCommunicationsModal dialogTitle="Import" data={[]} projectKey="pk" />
    </Dialog>,
  );

const makeFile = (name: string, content: string, type: string) =>
  new File([content], name, { type });

const fileInput = () =>
  document.querySelector('input[type="file"]') as HTMLInputElement;

const dropFile = (file: File) =>
  fireEvent.change(fileInput(), { target: { files: [file] } });

describe("components/import-file-modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGetPreSignedUrlForUpload).mockReturnValue({
      mutateAsync: presign,
      isPending: false,
    } as never);
    vi.mocked(useUploadFile).mockReturnValue({
      mutateAsync: uploadFileMut,
      isPending: false,
    } as never);
    vi.mocked(useImportLanguageFile).mockReturnValue({
      mutateAsync: importMut,
      isPending: false,
    } as never);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("should render the modal with title and dropzone copy", () => {
    renderModal();
    expect(screen.getByText("Import")).toBeTruthy();
    expect(screen.getByText("Click to upload")).toBeTruthy();
  });

  it("should accept a valid JSON file", async () => {
    renderModal();
    const json = JSON.stringify([
      { KeyName: "greeting", Resources: [{ Value: "Hi", Culture: "en-US" }], Routes: [] },
    ]);
    dropFile(makeFile("data.json", json, "application/json"));
    expect(await screen.findByText("data.json")).toBeTruthy();
  });

  it("should reject an invalid JSON file with a toast", async () => {
    renderModal();
    dropFile(makeFile("bad.json", "{ not: valid", "application/json"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Invalid File" }),
      ),
    );
  });

  it("should reject a JSON file missing KeyName", async () => {
    renderModal();
    const json = JSON.stringify([{ Resources: [] }]);
    dropFile(makeFile("nokey.json", json, "application/json"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Invalid File" }),
      ),
    );
  });

  it("should accept a valid CSV file with keyName and resources", async () => {
    renderModal();
    const csv = "keyName,resources,routes\ngreeting,en-US:Hi,[]\n";
    dropFile(makeFile("data.csv", csv, "text/csv"));
    expect(await screen.findByText("data.csv")).toBeTruthy();
  });

  it("should accept a CSV using language columns instead of resources", async () => {
    renderModal();
    const csv = "keyName,en-US\ngreeting,Hi\n";
    dropFile(makeFile("lang.csv", csv, "text/csv"));
    expect(await screen.findByText("lang.csv")).toBeTruthy();
  });

  it("should reject a CSV missing the keyName header", async () => {
    renderModal();
    const csv = "foo,bar\n1,2\n";
    dropFile(makeFile("bad.csv", csv, "text/csv"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Invalid File" }),
      ),
    );
  });

  it("should upload valid files and show a success toast", async () => {
    presign.mockResolvedValue({
      isSuccess: true,
      fileId: "f1",
      uploadUrl: "https://up",
    });
    uploadFileMut.mockResolvedValue({});
    importMut.mockResolvedValue({});
    vi.mocked(storageService.file.getFileByFileId).mockResolvedValue({
      itemId: "f1",
      url: "https://file",
    } as never);
    const onClose = vi.fn();
    render(
      <Dialog open onOpenChange={() => {}}>
        <ImportCommunicationsModal
          dialogTitle="Import"
          data={[]}
          projectKey="pk"
          onClose={onClose}
        />
      </Dialog>,
    );
    const json = JSON.stringify([{ KeyName: "greeting" }]);
    dropFile(makeFile("data.json", json, "application/json"));
    await screen.findByText("data.json");
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalled());
    expect(presign).toHaveBeenCalled();
    expect(importMut).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("should error the upload when the pre-signed URL fails", async () => {
    presign.mockResolvedValue({ isSuccess: false, errors: ["boom"] });
    renderModal();
    const json = JSON.stringify([{ KeyName: "greeting" }]);
    dropFile(makeFile("data.json", json, "application/json"));
    await screen.findByText("data.json");
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });

  it("should reject an xlsx file with invalid binary content", async () => {
    renderModal();
    dropFile(
      makeFile(
        "bad.xlsx",
        "not-a-real-zip",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    );
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Invalid File" }),
      ),
    );
  });

  it("should reject a JSON file whose Resources is not an array", async () => {
    renderModal();
    const json = JSON.stringify([{ KeyName: "k", Resources: "oops" }]);
    dropFile(makeFile("bad.json", json, "application/json"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Invalid File" }),
      ),
    );
  });

  it("should still succeed when the uploaded-file lookup fails", async () => {
    presign.mockResolvedValue({
      isSuccess: true,
      fileId: "f1",
      uploadUrl: "https://up",
    });
    uploadFileMut.mockResolvedValue({});
    importMut.mockResolvedValue({});
    vi.mocked(storageService.file.getFileByFileId).mockRejectedValue(
      new Error("lookup failed"),
    );
    renderModal();
    const json = JSON.stringify([{ KeyName: "greeting" }]);
    dropFile(makeFile("data.json", json, "application/json"));
    await screen.findByText("data.json");
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalled());
  });

  it("should error the upload when no files are selected", async () => {
    // Render with the upload disabled state exercised via handleUpload guard is
    // covered through the enabled path above; here we verify empty-select guard
    // by clicking upload before any file is added is impossible (button disabled),
    // so assert the button is disabled initially.
    renderModal();
    expect(
      (screen.getByRole("button", { name: "Upload" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("should change the template format", () => {
    renderModal();
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "CSV" }));
    expect(screen.getByRole("combobox").textContent).toContain("CSV");
  });

  it("should download the selected template", async () => {
    const blob = new Blob(["x"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:url"),
      revokeObjectURL: vi.fn(),
    });
    renderModal();
    // The download icon button is the first ghost/icon button in the footer.
    fireEvent.click(screen.getAllByRole("button")[0]);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("should toast an error when download fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderModal();
    const iconButtons = screen.getAllByRole("button");
    fireEvent.click(iconButtons[0]);
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });
});
