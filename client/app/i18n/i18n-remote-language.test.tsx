import { render, screen } from "@testing-library/react";
import { useI18nStore } from "@seliseblocks/genesis-os/i18n";
import { useAppSettingsStore } from "@seliseblocks/genesis-os/store";
import { afterEach, describe, expect, it } from "vitest";
import { SrOnlyText } from "@/components/sr-only-text/sr-only-text";

// Other languages come from the localization service at runtime; "xx" stands in for any of them.
describe("i18n remote language", () => {
  afterEach(() => {
    useAppSettingsStore.getState().setSettings({ language: "en" });
  });

  it("shows bundled English by default and the remote dictionary after switching language", () => {
    useI18nStore
      .getState()
      .setRemote("xx", "localization.shared", { "BREADCRUMB_ELLIPSIS.MORE": "More (xx)" });
    const { rerender } = render(<SrOnlyText textKey="BREADCRUMB_ELLIPSIS.MORE" />);
    expect(screen.getByText("More")).toBeTruthy();

    useAppSettingsStore.getState().setSettings({ language: "xx" });
    rerender(<SrOnlyText textKey="BREADCRUMB_ELLIPSIS.MORE" />);
    expect(screen.getByText("More (xx)")).toBeTruthy();
  });
});
