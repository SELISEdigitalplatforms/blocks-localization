import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast, toast } from "@/hooks/use-toast";
import { useImportLanguageFile } from "@blocks-localization/hooks/use-language-manager";
import { useGetPreSignedUrlForUpload, useUploadFile } from "@blocks-storage/hooks/use-storage-file";
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

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

const dropFile = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } });

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const encoder = new TextEncoder();

type ZipInput = { name: string; content: string };

// Builds a minimal ZIP (XLSX) archive with stored (uncompressed) entries so the
// reader/parser paths run for real. jsdom lacks Blob.stream(), so the archive is
// left uncompressed to keep the deflate path out of the test environment.
const buildZip = (files: ZipInput[]): Uint8Array => {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const rawBytes = encoder.encode(file.content);
    const dataBytes = rawBytes;
    const method = 0;

    const local = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, rawBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, rawBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, c) => sum + c.length, 0);
  const centralOffset = offset;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);

  const total = centralOffset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pointer = 0;
  for (const part of localParts) {
    out.set(part, pointer);
    pointer += part.length;
  }
  for (const part of centralParts) {
    out.set(part, pointer);
    pointer += part.length;
  }
  out.set(eocd, pointer);
  return out;
};

const SHARED_STRINGS =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  "<sst><si><t>keyName</t></si><si><t>resources</t></si>" +
  "<si><t>routes</t></si><si><t>unused</t></si>" +
  "<si><t>en-US:Hi</t></si></sst>";

const sheetXml = (routeValue: string) =>
  '<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>' +
  '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c>' +
  '<c r="C1" t="s"><v>2</v></c></row>' +
  '<row r="2"><c r="A2" t="inlineStr"><is><t>greeting</t></is></c>' +
  `<c r="B2" t="s"><v>4</v></c><c r="C2"><v>${routeValue}</v></c></row>` +
  "</sheetData></worksheet>";

const makeXlsxFile = (name: string, sheet: string, withStrings = true) => {
  const entries: ZipInput[] = [{ name: "xl/worksheets/sheet1.xml", content: sheet }];
  if (withStrings) {
    entries.push({ name: "xl/sharedStrings.xml", content: SHARED_STRINGS });
  }
  const bytes = buildZip(entries);
  return new File([bytes as unknown as BlobPart], name, { type: XLSX_MIME });
};

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
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject a JSON file missing KeyName", async () => {
    renderModal();
    const json = JSON.stringify([{ Resources: [] }]);
    dropFile(makeFile("nokey.json", json, "application/json"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
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
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
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
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject a JSON file whose Resources is not an array", async () => {
    renderModal();
    const json = JSON.stringify([{ KeyName: "k", Resources: "oops" }]);
    dropFile(makeFile("bad.json", json, "application/json"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
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
    vi.mocked(storageService.file.getFileByFileId).mockRejectedValue(new Error("lookup failed"));
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
    expect((screen.getByRole("button", { name: "Upload" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
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

  it("should accept a valid XLSX file parsed from a real archive", async () => {
    renderModal();
    const file = makeXlsxFile("data.xlsx", sheetXml("[]"));
    dropFile(file);
    expect(await screen.findByText("data.xlsx")).toBeTruthy();
  });

  it("should reject an XLSX file whose routes column is malformed", async () => {
    renderModal();
    const file = makeXlsxFile("bad-routes.xlsx", sheetXml("notarray"));
    dropFile(file);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject an XLSX file missing the keyName header", async () => {
    const sheet =
      '<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>foo</t></is></c>' +
      '<c r="B1" t="inlineStr"><is><t>bar</t></is></c></row>' +
      '<row r="2"><c r="A2" t="inlineStr"><is><t>x</t></is></c>' +
      '<c r="B2" t="inlineStr"><is><t>y</t></is></c></row>' +
      "</sheetData></worksheet>";
    renderModal();
    dropFile(makeXlsxFile("nokey.xlsx", sheet, false));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject an XLSX file with only a header row", async () => {
    const sheet =
      '<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
      "</sheetData></worksheet>";
    renderModal();
    dropFile(makeXlsxFile("empty.xlsx", sheet));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject an XLSX archive missing its worksheet", async () => {
    const bytes = buildZip([{ name: "xl/sharedStrings.xml", content: SHARED_STRINGS }]);
    renderModal();
    dropFile(
      new File([bytes as unknown as BlobPart], "noworksheet.xlsx", {
        type: XLSX_MIME,
      }),
    );
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should accept a semicolon-delimited CSV with quoted fields", async () => {
    renderModal();
    // A language column (en-US) stands in for resources; the escaped quote
    // exercises the CSV quote-parsing branch.
    const csv = 'keyName;en-US\n"greet";"say ""hi"""\n';
    dropFile(makeFile("semi.csv", csv, "text/csv"));
    expect(await screen.findByText("semi.csv")).toBeTruthy();
  });

  it("should accept a CSV with a newline inside a quoted field", async () => {
    renderModal();
    const csv = 'keyName,en-US\n"greeting","line one\nline two"\n';
    dropFile(makeFile("multiline.csv", csv, "text/csv"));
    expect(await screen.findByText("multiline.csv")).toBeTruthy();
  });

  it("should accept a CSV whose rows continue across records", async () => {
    renderModal();
    // The first physical line has fewer columns than the header and merges
    // into the following record, exercising the continuation logic.
    const csv = "keyName,en-US\nonlyone\nb,c\n";
    dropFile(makeFile("continued.csv", csv, "text/csv"));
    expect(await screen.findByText("continued.csv")).toBeTruthy();
  });

  it("should reject a CSV with an unterminated quoted field", async () => {
    renderModal();
    const csv = 'keyName,resources\n"unterminated\n';
    dropFile(makeFile("unterminated.csv", csv, "text/csv"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject a CSV whose resources value lacks a culture separator", async () => {
    renderModal();
    const csv = "keyName,resources\ngreeting,nocolon\n";
    dropFile(makeFile("badres.csv", csv, "text/csv"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject a CSV whose routes value is malformed", async () => {
    renderModal();
    const csv = "keyName,resources,routes\ngreeting,en-US:Hi,notarray\n";
    dropFile(makeFile("badroutes.csv", csv, "text/csv"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject a CSV whose keyName cell is empty", async () => {
    renderModal();
    const csv = "keyName,resources\n,en-US:Hi\n";
    dropFile(makeFile("emptykey.csv", csv, "text/csv"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject a JSON file whose Routes is not an array", async () => {
    renderModal();
    const json = JSON.stringify([{ KeyName: "k", Routes: "oops" }]);
    dropFile(makeFile("badroutes.json", json, "application/json"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject a JSON resource entry with non-string fields", async () => {
    renderModal();
    const json = JSON.stringify([{ KeyName: "k", Resources: [{ Value: 1, Culture: "en-US" }] }]);
    dropFile(makeFile("badresource.json", json, "application/json"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject an empty JSON array", async () => {
    renderModal();
    dropFile(makeFile("empty.json", "[]", "application/json"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject a JSON payload that is not an array", async () => {
    renderModal();
    dropFile(makeFile("object.json", "{}", "application/json"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid File" })),
    );
  });

  it("should reject a file with an unsupported extension", async () => {
    renderModal();
    dropFile(makeFile("notes.txt", "hello", "text/plain"));
    // A disallowed extension never reaches the file list.
    await waitFor(() => expect(screen.queryByText("notes.txt")).toBeNull());
  });

  it("should clear the selection when a file is removed", async () => {
    renderModal();
    const json = JSON.stringify([{ KeyName: "greeting" }]);
    dropFile(makeFile("data.json", json, "application/json"));
    await screen.findByText("data.json");
    fireEvent.click(screen.getByText("remove item 0"));
    await waitFor(() => expect(screen.queryByText("data.json")).toBeNull());
  });
});
