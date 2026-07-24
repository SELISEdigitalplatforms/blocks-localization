import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExtensionGuides } from "./extension-guides";

const setClipboard = (value: unknown) =>
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true,
    writable: true,
  });

const { getRuntimeEnvMock } = vi.hoisted(() => ({
  getRuntimeEnvMock: vi.fn(),
}));

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: getRuntimeEnvMock,
}));

describe("ExtensionGuides", () => {
  beforeEach(() => {
    getRuntimeEnvMock.mockImplementation((key: string) => {
      if (key === "BLOCKS_PUBLIC_API_BASE_URL") {
        return "https://runtime-api.example.com";
      }
      if (key === "BLOCKS_X_BLOCKS_KEY") {
        return "runtime-blocks-key";
      }
      return "";
    });
  });

  it("displays the API Base URL and X-Blocks-Key from runtime configuration", () => {
    render(<ExtensionGuides />);

    expect(screen.getByText("https://runtime-api.example.com")).toBeTruthy();
    expect(screen.getByText("runtime-blocks-key")).toBeTruthy();
    expect(getRuntimeEnvMock).toHaveBeenCalledWith("BLOCKS_PUBLIC_API_BASE_URL");
    expect(getRuntimeEnvMock).toHaveBeenCalledWith("BLOCKS_X_BLOCKS_KEY");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies a value using the clipboard API and shows a confirmation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<ExtensionGuides />);

    fireEvent.click(screen.getByLabelText("Copy API Base URL"));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://runtime-api.example.com"));
    expect(await screen.findByText("Copied")).toBeTruthy();
  });

  it("falls back to execCommand when the clipboard API is unavailable", async () => {
    setClipboard(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand as never;
    render(<ExtensionGuides />);

    fireEvent.click(screen.getByLabelText("Copy X-Blocks-Key"));

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    expect(await screen.findByText("Copied")).toBeTruthy();
  });

  it("keeps the copied state cleared when the fallback copy fails", async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn().mockReturnValue(false) as never;
    render(<ExtensionGuides />);

    fireEvent.click(screen.getByLabelText("Copy API Base URL"));

    await waitFor(() => expect(document.execCommand).toHaveBeenCalled());
    expect(screen.queryByText("Copied")).toBeNull();
  });

  it("clears the copied indicator after the timeout elapses", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<ExtensionGuides />);

    fireEvent.click(screen.getByLabelText("Copy API Base URL"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Copied")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.queryByText("Copied")).toBeNull();
  });
});
