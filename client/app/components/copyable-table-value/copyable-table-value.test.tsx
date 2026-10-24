import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { CopyableTableValue } from "./copyable-table-value";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

const setClipboard = (value: unknown) =>
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value,
  });

describe("CopyableTableValue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("copies the value without triggering its clickable row", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onRowClick = vi.fn();
    setClipboard({ writeText });

    renderWithProviders(
      <div className="group" onClick={onRowClick}>
        <CopyableTableValue value="welcome.title" label="key" />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy key" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("welcome.title"));
    expect(onRowClick).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Copied key" })).toBeTruthy();
  });

  it("does not render a copy button for an empty value", () => {
    renderWithProviders(
      <CopyableTableValue value="" displayValue="No translation" label="English value" />,
    );

    expect(screen.getByText("No translation")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the copy button adjacent to the value", () => {
    renderWithProviders(<CopyableTableValue value="welcome.title" label="key" />);

    const value = screen.getByText("welcome.title");
    expect(value.className).toContain("max-w-full");
    expect(value.className).not.toContain("flex-1");
  });

  it("hides the copy button until hover or long press", () => {
    renderWithProviders(<CopyableTableValue value="welcome.title" label="key" />);

    const button = screen.getByRole("button", { name: "Copy key" });
    expect(button.className).toContain("opacity-0");
    expect(button.getAttribute("data-revealed")).toBe("false");
  });

  it("reveals the copy button on a touch long press without triggering its row", () => {
    vi.useFakeTimers();
    const onRowClick = vi.fn();

    try {
      renderWithProviders(
        <div onClick={onRowClick}>
          <CopyableTableValue value="welcome.title" label="key" />
        </div>,
      );

      const value = screen.getByText("welcome.title");
      fireEvent.pointerDown(value, { pointerType: "touch", clientX: 10, clientY: 10 });
      act(() => vi.advanceTimersByTime(500));
      fireEvent.pointerUp(value, { pointerType: "touch" });
      fireEvent.click(value);

      const button = screen.getByRole("button", { name: "Copy key" });
      expect(button.getAttribute("data-revealed")).toBe("true");
      expect(onRowClick).not.toHaveBeenCalled();

      fireEvent.pointerDown(document.body);
      expect(button.getAttribute("data-revealed")).toBe("false");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a short tap opening the row", () => {
    vi.useFakeTimers();
    const onRowClick = vi.fn();

    try {
      renderWithProviders(
        <div onClick={onRowClick}>
          <CopyableTableValue value="welcome.title" label="key" />
        </div>,
      );

      const value = screen.getByText("welcome.title");
      fireEvent.pointerDown(value, { pointerType: "touch", clientX: 10, clientY: 10 });
      act(() => vi.advanceTimersByTime(200));
      fireEvent.pointerUp(value, { pointerType: "touch" });
      fireEvent.click(value);
      act(() => vi.advanceTimersByTime(500));

      expect(onRowClick).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Copy key" }).getAttribute("data-revealed")).toBe(
        "false",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("copies when the revealed button is held on touch instead of treating it as a long press", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    try {
      renderWithProviders(<CopyableTableValue value="welcome.title" label="key" />);

      const value = screen.getByText("welcome.title");
      fireEvent.pointerDown(value, { pointerType: "touch", clientX: 10, clientY: 10 });
      act(() => vi.advanceTimersByTime(500));
      fireEvent.pointerUp(value, { pointerType: "touch" });

      const button = screen.getByRole("button", { name: "Copy key" });
      fireEvent.pointerDown(button, { pointerType: "touch", clientX: 40, clientY: 10 });
      act(() => vi.advanceTimersByTime(500));
      fireEvent.pointerUp(button, { pointerType: "touch" });
      fireEvent.click(button);

      expect(writeText).toHaveBeenCalledWith("welcome.title");
    } finally {
      vi.useRealTimers();
    }
  });
});
