import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ILanguageConfig } from "@blocks-localization/models/language";
import { createDefaultGlossaryMeta } from "@blocks-localization/utils/glossary-meta";
import GlossaryTranslationChips from "./glossary-translation-chips";

const languages = ["en-US", "de-DE", "fr-FR", "es-ES", "it-IT", "nl-NL", "pt-PT"].map(
  (languageCode, index) => ({ languageCode, languageName: languageCode, isDefault: index === 0 }),
) as ILanguageConfig[];

const meta = {
  ...createDefaultGlossaryMeta(),
  translations: { "de-DE": "Arbeitsbereich", "fr-FR": "Espace" },
};

describe("GlossaryTranslationChips", () => {
  it("shows 4 chips by default, as in the glossary table", () => {
    render(<GlossaryTranslationChips meta={meta} languages={languages} />);
    expect(screen.getByText("de-DE")).toBeTruthy();
    expect(screen.getByText("it-IT")).toBeTruthy();
    expect(screen.queryByText(/nl-NL/)).toBeNull();
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("limits the chips with max", () => {
    render(<GlossaryTranslationChips meta={meta} languages={languages} max={3} />);
    expect(screen.getByText("es-ES")).toBeTruthy();
    expect(screen.queryByText(/it-IT/)).toBeNull();
    expect(screen.getByText("+3")).toBeTruthy();
  });

  it("shows only the code on a missing chip and says it is missing on hover", async () => {
    const user = userEvent.setup();
    render(<GlossaryTranslationChips meta={meta} languages={languages} />);

    const chip = screen.getByText("es-ES");
    expect(screen.queryByText(/es-ES missing/)).toBeNull();
    // Screen readers hear the state without hovering.
    expect(chip.textContent).toBe("es-ES is missing");

    await user.hover(chip);
    expect((await screen.findByRole("tooltip")).textContent).toBe("es-ES is missing");
  });

  it("renders a dash for rules without translations", () => {
    render(
      <GlossaryTranslationChips meta={{ ...meta, rule: "keep" }} languages={languages} max={3} />,
    );
    expect(screen.getByText("—")).toBeTruthy();
  });
});
