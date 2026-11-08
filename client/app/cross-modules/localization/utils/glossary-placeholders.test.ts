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

  it("blanks ICU select option names but keeps their branch text", () => {
    const text = "{role, select, admin {Admin panel} other {Panel}}";
    const result = masked(text);
    expect(result).toHaveLength(text.length);
    expect(result).toBe(blanked(text, "{role, select,", "admin", "other", "{Panel}"));
    expect(result.slice(0, 14).trim()).toBe("");
    expect(result.slice(15, 20)).toBe("     ");
    expect(result.slice(22, 27)).toBe("Admin");
  });

  it("blanks only option names at the select's own depth", () => {
    const text = "{role, select, admin {Hi admin now} other {All admins}} and admin {y}";
    expect(masked(text)).toBe(
      blanked(text, "{role, select,", "admin", "other").replace("{y}", "   "),
    );
  });

  it("masks option names of a select nested in a plural branch", () => {
    const text = "{n, plural, one {{g, select, admin {Admin area} other {All areas}}} other {# items}}";
    const result = masked(text);
    expect(result).toHaveLength(text.length);
    expect(result).not.toMatch(/\badmin\b/);
    expect(result).toContain("Admin area");
    expect(result).toContain("All areas");
  });

  it("leaves plain text and stray symbols alone", () => {
    expect(masked("50% off, a < b > c, {not closed")).toBe("50% off, a < b > c, {not closed");
    expect(masked("One other thing")).toBe("One other thing");
  });
});
