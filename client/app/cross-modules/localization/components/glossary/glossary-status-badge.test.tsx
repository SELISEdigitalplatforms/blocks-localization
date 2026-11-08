import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GlossaryStatusBadge, {
  GLOSSARY_STATUS_LABELS,
} from "@blocks-localization/components/glossary/glossary-status-badge";

describe("GlossaryStatusBadge", () => {
  it.each([
    ["approved", "Approved", "bg-green-100"],
    ["draft", "Draft", "text-foreground"],
    ["deprecated", "Deprecated", "bg-secondary"],
  ] as const)("renders %s with its icon, text and variant", (status, label, variantClass) => {
    const { container } = render(<GlossaryStatusBadge status={status} />);
    const badge = screen.getByText(label);
    expect(badge.className).toContain(variantClass);
    expect(container.querySelector("svg[aria-hidden='true']")).toBeTruthy();
    expect(GLOSSARY_STATUS_LABELS[status]).toBe(label);
  });
});
