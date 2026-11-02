import { describe, expect, it } from "vitest";

import { maskPlaceholders } from "@blocks-localization/utils/glossary-placeholders";

const masked = (text: string) => maskPlaceholders(text);
/** `text` with each of `spans` replaced by spaces of the same length. */
const blanked = (text: string, ...spans: string[]) =>
  spans.reduce((result, span) => result.replace(span, " ".repeat(span.length)), text);

describe("utils/glossary-placeholders maskPlaceholders", () => {
  it.each([
    ["Welcome, {user}!", "Welcome,       !"],
    ["Hi {{name}}", "Hi         "],
    ["Id ${id}", "Id      "],
    ["{0} files", "    files"],
    ["Total {amount, number, currency}", "Total                           "],
    ["Click <a href=\"/user\">here</a>", "Click                 here    "],
    ["%s of %1$d user", "   of      user"],
    ["100%% user", "100   user"],
  ])("blanks %j", (text, expected) => {
    expect(masked(text)).toBe(expected);
    expect(masked(text)).toHaveLength(text.length);
  });

  it("keeps ICU branch text but blanks the header and selectors", () => {
    const text = "{count, plural, one {# user} other {# users}}";
    expect(masked(text)).toBe(blanked(text, "{count, plural, one", "other"));
  });

  it("leaves plain text and stray symbols alone", () => {
    expect(masked("50% off, a < b > c, {not closed")).toBe("50% off, a < b > c, {not closed");
    expect(masked("One other thing")).toBe("One other thing");
  });
});
