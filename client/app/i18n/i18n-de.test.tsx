import { render, screen } from "@testing-library/react";
import { useI18nStore } from "@seliseblocks/genesis-os/i18n";
import { useAppSettingsStore } from "@seliseblocks/genesis-os/store";
import { afterEach, describe, expect, it } from "vitest";
import { SrOnlyText } from "@/components/sr-only-text/sr-only-text";

describe("i18n German", () => {
  afterEach(() => {
    useAppSettingsStore.getState().setSettings({ language: "en" });
  });

  it("shows English by default and German after switching", () => {
    useI18nStore
      .getState()
      .setRemote("de", "localization.shared", { "BREADCRUMB_ELLIPSIS.MORE": "Mehr" });
    const { rerender } = render(<SrOnlyText textKey="BREADCRUMB_ELLIPSIS.MORE" />);
    expect(screen.getByText("More")).toBeTruthy();

    useAppSettingsStore.getState().setSettings({ language: "de" });
    rerender(<SrOnlyText textKey="BREADCRUMB_ELLIPSIS.MORE" />);
    expect(screen.getByText("Mehr")).toBeTruthy();
  });
});
