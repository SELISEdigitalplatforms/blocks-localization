import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui-kits/tooltip/tooltip";
import type { IDuplicateSummary } from "@blocks-localization/models/language";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import {
  DUPLICATE_MODULES_TOOLTIP,
  DuplicateKeysChips,
  enforceUniquenessFlag,
} from "./duplicate-keys-chips";

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => toastMock(...a) }));

vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetDuplicateSummary: vi.fn(),
  useEnforceUniqueness: vi.fn(),
}));

const h = vi.mocked(hooks);
const enforce = vi.fn();
let urlUpdates: UrlUpdateEvent[] = [];

const summary = (overrides: Partial<IDuplicateSummary> = {}): IDuplicateSummary => ({
  keyGroupCount: 2,
  duplicateKeyRowCount: 5,
  extraKeyCount: 3,
  moduleGroupCount: 0,
  extraModuleCount: 0,
  keyUniquenessEnforced: false,
  moduleUniquenessEnforced: true,
  ...overrides,
});

const withSummary = (data: IDuplicateSummary | undefined, isError = false) =>
  h.useGetDuplicateSummary.mockReturnValue({ data, isError } as never);

const renderChips = (searchParams = "") =>
  render(<DuplicateKeysChips />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={(e) => urlUpdates.push(e)}>
        <TooltipProvider>{children}</TooltipProvider>
      </NuqsTestingAdapter>
    ),
  });

const lastSearch = () => urlUpdates.at(-1)?.searchParams;

describe("DuplicateKeysChips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    urlUpdates = [];
    window.sessionStorage.clear();
    h.useEnforceUniqueness.mockReturnValue({ mutate: enforce } as never);
  });

  it.each([
    ["while the summary is loading", undefined, false],
    ["when the summary failed", summary(), true],
  ])("shows nothing %s", (_label, data, isError) => {
    withSummary(data, isError);
    const { container } = renderChips();
    expect(container.innerHTML).toBe("");
  });

  it("shows nothing when there are no duplicates", () => {
    withSummary(
      summary({
        keyGroupCount: 0,
        duplicateKeyRowCount: 0,
        extraKeyCount: 0,
        keyUniquenessEnforced: true,
      }),
    );
    const { container } = renderChips();
    expect(container.innerHTML).toBe("");
  });

  it("shows the number of extra rows as an inactive warning button", () => {
    withSummary(summary());
    renderChips();

    const chip = screen.getByRole("button", { name: /^3 duplicates\./ });
    expect(chip.getAttribute("type")).toBe("button");
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(chip.getAttribute("aria-label")).toBe(
      "3 duplicates. 2 keys have more than one row in the same module. Click to show them.",
    );
    expect(chip.classList.contains("rounded-full")).toBe(true);
    expect(chip.classList.contains("ring-2")).toBe(false);
  });

  it("uses the singular for one extra row", () => {
    withSummary(summary({ keyGroupCount: 1, duplicateKeyRowCount: 2, extraKeyCount: 1 }));
    renderChips();
    expect(screen.getByRole("button", { name: /^1 duplicate\./ }).textContent).toBe("1 duplicate");
  });

  it("turns the filter on and goes back to the first page", async () => {
    withSummary(summary());
    renderChips("?pageNumber=3");

    fireEvent.click(screen.getByTestId("duplicate-keys-chip"));

    await waitFor(() => expect(lastSearch()?.get("duplicates")).toBe("true"));
    expect(lastSearch()?.has("pageNumber")).toBe(false);
  });

  it("shows the active state and turns the filter off again", async () => {
    withSummary(summary());
    renderChips("?duplicates=true");

    const chip = screen.getByTestId("duplicate-keys-chip");
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(chip.classList.contains("ring-2")).toBe(true);

    fireEvent.click(chip);
    await waitFor(() => expect(lastSearch()?.has("duplicates")).toBe(false));
  });

  it("clears the filter once the last duplicate is gone", async () => {
    withSummary(summary({ keyGroupCount: 0, duplicateKeyRowCount: 0, extraKeyCount: 0 }));
    renderChips("?duplicates=true&moduleIds=m1");

    await waitFor(() => expect(lastSearch()?.has("duplicates")).toBe(false));
    expect(lastSearch()?.get("moduleIds")).toBe("m1");
  });

  it.each([
    [1, "1 duplicate module"],
    [2, "2 duplicate modules"],
  ])("reports %i extra module(s) with a non-interactive badge", (count, text) => {
    withSummary(
      summary({ moduleGroupCount: 1, extraModuleCount: count, moduleUniquenessEnforced: false }),
    );
    renderChips();

    const badge = screen.getByTestId("duplicate-modules-badge");
    expect(badge.textContent).toBe(text);
    expect(badge.tagName).not.toBe("BUTTON");
    expect(screen.getByLabelText(`${text}. ${DUPLICATE_MODULES_TOOLTIP}`)).toBeTruthy();
  });

  it("never brings back the removed partial-translation badge", () => {
    withSummary(summary());
    renderChips();
    expect(screen.queryByText(/partial/i)).toBeNull();
  });

  describe("turning on duplicate prevention", () => {
    it("asks once per tenant per browser session when the keys are clean", () => {
      withSummary(summary({ keyGroupCount: 0, duplicateKeyRowCount: 0, extraKeyCount: 0 }));
      const first = renderChips();
      first.unmount();
      renderChips();

      expect(enforce).toHaveBeenCalledTimes(1);
      expect(window.sessionStorage.getItem(enforceUniquenessFlag("tenant-1"))).not.toBeNull();
    });

    it("still asks for the keys once they become clean after the modules were requested", () => {
      // First visit: modules are clean, keys still have duplicates.
      withSummary(summary({ moduleUniquenessEnforced: false }));
      renderChips().unmount();
      expect(enforce).toHaveBeenCalledTimes(1);
      expect(window.sessionStorage.getItem(enforceUniquenessFlag("tenant-1"))).toBe("modules");

      // Same session, after the duplicates were deleted: the keys get their one request.
      withSummary(
        summary({
          keyGroupCount: 0,
          duplicateKeyRowCount: 0,
          extraKeyCount: 0,
          moduleUniquenessEnforced: true,
        }),
      );
      renderChips().unmount();
      expect(enforce).toHaveBeenCalledTimes(2);

      // Nothing new is ready: no third request.
      renderChips();
      expect(enforce).toHaveBeenCalledTimes(2);
    });

    it("asks when only the modules are clean and unprotected", () => {
      withSummary(summary({ moduleUniquenessEnforced: false }));
      renderChips();
      expect(enforce).toHaveBeenCalledTimes(1);
    });

    it("does not ask while duplicates remain or once everything is protected", () => {
      withSummary(summary());
      renderChips().unmount();
      withSummary(
        summary({
          keyGroupCount: 0,
          duplicateKeyRowCount: 0,
          extraKeyCount: 0,
          keyUniquenessEnforced: true,
        }),
      );
      renderChips();

      expect(enforce).not.toHaveBeenCalled();
    });

    it("stays silent when the request is refused", () => {
      withSummary(summary({ keyGroupCount: 0, duplicateKeyRowCount: 0, extraKeyCount: 0 }));
      renderChips();

      const options = enforce.mock.calls[0][1] as { onError: (e: unknown) => void };
      act(() => options.onError(Object.assign(new Error("Forbidden"), { status: 403 })));

      expect(toastMock).not.toHaveBeenCalled();
      expect(enforce).toHaveBeenCalledTimes(1);
    });
  });
});
