import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("it-IT missing")).toBeTruthy();
    expect(screen.queryByText(/nl-NL/)).toBeNull();
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("limits the chips with max", () => {
    render(<GlossaryTranslationChips meta={meta} languages={languages} max={3} />);
    expect(screen.getByText("es-ES missing")).toBeTruthy();
    expect(screen.queryByText(/it-IT/)).toBeNull();
    expect(screen.getByText("+3")).toBeTruthy();
  });

  it("renders a dash for rules without translations", () => {
    render(
      <GlossaryTranslationChips meta={{ ...meta, rule: "keep" }} languages={languages} max={3} />,
    );
    expect(screen.getByText("—")).toBeTruthy();
  });
});
