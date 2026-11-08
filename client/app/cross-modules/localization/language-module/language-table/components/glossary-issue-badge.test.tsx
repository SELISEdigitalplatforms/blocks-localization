import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui-kits/tooltip/tooltip";
import type { IKeyGlossaryViolation } from "@blocks-localization/models/language";
import {
  GlossaryIssueBadge,
  getGlossaryIssueLabel,
  getGlossaryIssueLines,
} from "./glossary-issue-badge";

const violation = (overrides: Partial<IKeyGlossaryViolation> = {}): IKeyGlossaryViolation => ({
  culture: "de-DE",
  glossaryId: "g1",
  term: "Workspace",
  kind: "forbidden-used",
  found: "Werkbereich",
  detectedAt: "2026-10-28T00:00:00Z",
  ...overrides,
});

const renderBadge = (violations: IKeyGlossaryViolation[] | undefined) =>
  render(
    <TooltipProvider delayDuration={0}>
      <GlossaryIssueBadge violations={violations} />
    </TooltipProvider>,
  );

describe("GlossaryIssueBadge", () => {
  it.each([
    [1, "1 glossary issue"],
    [2, "2 glossary issues"],
    [10, "10 glossary issues"],
  ])("labels %i violation(s) as %s", (count, label) => {
    expect(getGlossaryIssueLabel(count)).toBe(label);
  });

  it("formats one '<culture>: <message>' line per stored violation (Example 4)", () => {
    expect(
      getGlossaryIssueLines([
        violation(),
        violation({
          culture: "fr-FR",
          kind: "missing-translation",
          expected: "Espace de travail",
          found: undefined,
        }),
        violation({ culture: "es-ES", term: "SELISE", kind: "missing-keep", expected: "SELISE" }),
      ]),
    ).toEqual([
      'de-DE: "Werkbereich" is not allowed',
      'fr-FR: Expected "Espace de travail" for "Workspace"',
      'es-ES: Keep "SELISE" unchanged',
    ]);
  });

  it.each([[undefined], [[]]])("renders nothing without violations (%j)", (violations) => {
    const { container } = renderBadge(violations);
    expect(container.innerHTML).toBe("");
  });

  it("shows the count and lists the issues in a tooltip that opens on keyboard focus", async () => {
    renderBadge([violation(), violation({ culture: "fr-FR", found: "Atelier" })]);

    const badge = screen.getByTestId("glossary-issue-badge");
    expect(badge.textContent).toBe("2 glossary issues");
    expect(badge.getAttribute("tabindex")).toBe("0");

    fireEvent.focus(badge);
    await waitFor(() =>
      expect(screen.getAllByText('de-DE: "Werkbereich" is not allowed').length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText('fr-FR: "Atelier" is not allowed').length).toBeGreaterThan(0);
  });
});
