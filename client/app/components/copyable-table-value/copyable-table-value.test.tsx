import { fireEvent, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByRole("button", { name: "Copied key" })).toBeTruthy();
  });

  it("does not render a copy button for an empty value", () => {
    renderWithProviders(
      <CopyableTableValue value="" displayValue="No translation" label="English value" />,
    );

    expect(screen.getByText("No translation")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
