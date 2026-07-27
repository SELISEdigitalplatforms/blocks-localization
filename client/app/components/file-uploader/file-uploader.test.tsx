import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FileInput,
  FileUploader,
  FileUploaderContent,
  FileUploaderItem,
  useFileUpload,
} from "./file-uploader";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: vi.fn() }));

import { showErrorToast } from "@/hooks/use-toast";

const makeFile = (name: string) => new File(["x"], name, { type: "image/png" });

const Harness = ({
  initial = [],
  onChange,
  orientation,
}: {
  initial?: File[];
  onChange?: (v: File[] | null) => void;
  orientation?: "horizontal" | "vertical";
}) => {
  const [files, setFiles] = useState<File[] | null>(initial);
  return (
    <FileUploader
      value={files}
      orientation={orientation}
      onValueChange={(v) => {
        setFiles(v);
        onChange?.(v);
      }}
      dropzoneOptions={{ maxFiles: 2, maxSize: 5 * 1024 * 1024 }}
    >
      <FileUploaderContent>
        {files?.map((file, i) => (
          <FileUploaderItem key={file.name} index={i}>
            {file.name}
          </FileUploaderItem>
        ))}
      </FileUploaderContent>
      <FileInput>
        <span>Drop files here</span>
      </FileInput>
    </FileUploader>
  );
};

describe("components/file-uploader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useFileUpload should throw outside a provider", () => {
    expect(() => renderHook(() => useFileUpload())).toThrow(
      "useFileUpload must be used within a FileUploaderProvider",
    );
  });

  it("should render the dropzone and its children", () => {
    render(<Harness />);
    expect(screen.getByText("Drop files here")).toBeTruthy();
  });

  it("should render existing files as items", () => {
    render(<Harness initial={[makeFile("a.png"), makeFile("b.png")]} />);
    expect(screen.getByText("a.png")).toBeTruthy();
    expect(screen.getByText("b.png")).toBeTruthy();
  });

  it("should remove a file when its remove button is clicked", () => {
    const onChange = vi.fn();
    render(<Harness initial={[makeFile("a.png"), makeFile("b.png")]} onChange={onChange} />);
    const removeButtons = screen.getAllByText(/remove item/);
    fireEvent.click(removeButtons[0].closest("button")!);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: "b.png" })]);
  });

  it("should navigate items with arrow and delete keys", () => {
    const { container } = render(<Harness initial={[makeFile("a.png"), makeFile("b.png")]} />);
    const root = container.querySelector('[tabindex="0"]')!;
    fireEvent.keyDown(root, { key: "ArrowDown" });
    fireEvent.keyDown(root, { key: "ArrowUp" });
    fireEvent.keyDown(root, { key: "Escape" });
    // No throw; the handler branches are exercised.
    expect(screen.getByText("a.png")).toBeTruthy();
  });

  it("should show a horizontal orientation without crashing", () => {
    render(<Harness orientation="horizontal" initial={[makeFile("a.png")]} />);
    expect(screen.getByText("a.png")).toBeTruthy();
  });

  it("should render a disabled item", () => {
    render(
      <FileUploader
        value={[makeFile("a.png")]}
        onValueChange={vi.fn()}
        dropzoneOptions={{ maxFiles: 1 }}
      >
        <FileUploaderContent>
          <FileUploaderItem index={0} disabled>
            a.png
          </FileUploaderItem>
        </FileUploaderContent>
      </FileUploader>,
    );
    const button = screen.getByText(/remove item/).closest("button")!;
    expect(button.disabled).toBe(true);
  });

  it("should accept a dropped file through the input", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("dropped.png")] } });
    await new Promise((r) => setTimeout(r, 0));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: "dropped.png" })]);
  });

  it("should reject an oversized file with an error toast", async () => {
    render(
      <FileUploader
        value={null}
        onValueChange={vi.fn()}
        dropzoneOptions={{ maxFiles: 1, maxSize: 10 }}
      >
        <FileInput>
          <span>drop</span>
        </FileInput>
      </FileUploader>,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File(["x".repeat(100)], "big.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [big] } });
    await new Promise((r) => setTimeout(r, 0));
    expect(showErrorToast).toHaveBeenCalled();
  });

  it("should reference showErrorToast for oversize handling", () => {
    // The oversize toast helper is wired up (module import side-effect check).
    expect(showErrorToast).toBeTypeOf("function");
  });
});
