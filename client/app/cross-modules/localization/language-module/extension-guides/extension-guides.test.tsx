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
      if (key === "BLOCKS_LOCALIZATION_BASE_URL") {
        return "https://localization.example.com/";
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

  it("provides copyable JSON and curl alternatives from runtime configuration", () => {
    render(<ExtensionGuides />);

    expect(
      screen.getByText(/"BLOCKS_PUBLIC_API_BASE_URL": "https:\/\/runtime-api\.example\.com"/),
    ).toBeTruthy();
    expect(
      screen.getByText(/"BLOCKS_X_BLOCKS_KEY": "runtime-blocks-key"/),
    ).toBeTruthy();
    expect(
      screen.getByText("curl https://localization.example.com"),
    ).toBeTruthy();
    expect(getRuntimeEnvMock).toHaveBeenCalledWith(
      "BLOCKS_LOCALIZATION_BASE_URL",
    );
  });
});

describe("ExtensionGuides copy to clipboard", () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  beforeEach(() => {
    getRuntimeEnvMock.mockImplementation((key: string) => {
      if (key === "BLOCKS_PUBLIC_API_BASE_URL") return "https://runtime-api.example.com";
      if (key === "BLOCKS_X_BLOCKS_KEY") return "runtime-blocks-key";
      if (key === "BLOCKS_LOCALIZATION_BASE_URL") return "https://localization.example.com/";
      return "";
    });
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const copyButton = (label: string) => screen.getByRole("button", { name: `Copy ${label}` });

  it("writes the value with the clipboard api and marks the field copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<ExtensionGuides />);

    fireEvent.click(copyButton("API Base URL"));

    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith("https://runtime-api.example.com");
  });

  it("clears the copied marker after the two second timeout", async () => {
    vi.useFakeTimers();
    try {
      const writeText = vi.fn().mockResolvedValue(undefined);
      setClipboard({ writeText });
      render(<ExtensionGuides />);

      fireEvent.click(copyButton("X-Blocks-Key"));
      // let the awaited writeText settle before the timer is asserted
      await act(async () => {});
      expect(screen.getByText("Copied")).toBeTruthy();

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByText("Copied")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to execCommand when the clipboard api is unavailable", async () => {
    setClipboard(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand as unknown as typeof document.execCommand;
    render(<ExtensionGuides />);

    fireEvent.click(copyButton("API Base URL"));

    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
    expect(execCommand).toHaveBeenCalledWith("copy");
    // the temporary textarea must not be left behind in the document
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("leaves the field unmarked when the fallback copy command fails", async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn().mockReturnValue(false) as unknown as typeof document.execCommand;
    render(<ExtensionGuides />);

    fireEvent.click(copyButton("API Base URL"));

    await waitFor(() => expect(document.querySelector("textarea")).toBeNull());
    expect(screen.queryByText("Copied")).toBeNull();
  });

  it("leaves the field unmarked when the clipboard api rejects", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    render(<ExtensionGuides />);

    fireEvent.click(copyButton("API Base URL"));

    await act(async () => {});
    expect(screen.queryByText("Copied")).toBeNull();
  });
});
