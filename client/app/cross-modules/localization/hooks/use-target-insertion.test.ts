import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { insertAtRange, useTargetInsertion } from "./use-target-insertion";

describe("insertAtRange", () => {
  it("inserts at a collapsed caret and keeps the text around it", () => {
    expect(insertAtRange("Öffnen Sie ", "Arbeitsbereich", { start: 11, end: 11 })).toEqual({
      text: "Öffnen Sie Arbeitsbereich",
      caret: 25,
    });
  });

  it("replaces only the selected range (C22)", () => {
    expect(
      insertAtRange("Ihren Werkbereich öffnen", "Arbeitsbereich", { start: 6, end: 17 }),
    ).toEqual({ text: "Ihren Arbeitsbereich öffnen", caret: 20 });
  });

  it("appends after one space when the target was never focused", () => {
    expect(insertAtRange("Öffnen", "SELISE")).toEqual({ text: "Öffnen SELISE", caret: 13 });
    expect(insertAtRange("Öffnen ", "SELISE")).toEqual({ text: "Öffnen SELISE", caret: 13 });
    expect(insertAtRange("", "SELISE")).toEqual({ text: "SELISE", caret: 6 });
  });

  it("clamps a range that is past the end of the text", () => {
    expect(insertAtRange("ab ", "X", { start: 10, end: 12 })).toEqual({ text: "ab X", caret: 4 });
  });

  it("adds a space where the value would run into a word", () => {
    expect(insertAtRange("SELISE login", "Portal", { start: 12, end: 12 })).toEqual({
      text: "SELISE login Portal",
      caret: 19,
    });
    expect(insertAtRange("Ihren öffnen", "Bereich", { start: 5, end: 5 })).toEqual({
      text: "Ihren Bereich öffnen",
      caret: 13,
    });
    expect(insertAtRange("Ihrenöffnen", "Bereich", { start: 5, end: 5 })).toEqual({
      text: "Ihren Bereich öffnen",
      caret: 13,
    });
  });

  it("adds no space next to punctuation or in no-space languages", () => {
    expect(insertAtRange("(", "Portal", { start: 1, end: 1 })).toEqual({
      text: "(Portal",
      caret: 7,
    });
    expect(insertAtRange("开始", "工作区", { start: 2, end: 2 }, "zh-CN")).toEqual({
      text: "开始工作区",
      caret: 5,
    });
  });
});

describe("useTargetInsertion", () => {
  const setup = () => {
    const values: Record<string, string> = { "de-DE": "Hallo ", "fr-FR": "Bonjour" };
    const setValue = vi.fn((culture: string, value: string) => {
      values[culture] = value;
    });
    const hook = renderHook(() =>
      useTargetInsertion({
        cultures: ["de-DE", "fr-FR"],
        getValue: (culture) => values[culture],
        setValue,
      }),
    );
    return { ...hook, values, setValue };
  };

  const textarea = (value: string) => {
    const element = document.createElement("textarea");
    element.value = value;
    document.body.appendChild(element);
    return element;
  };

  it("targets the first row before any target was focused (H13)", () => {
    const { result, setValue } = setup();
    expect(result.current.targetCulture).toBe("de-DE");
    act(() => result.current.insert("Arbeitsbereich"));
    expect(setValue).toHaveBeenCalledWith("de-DE", "Hallo Arbeitsbereich");
  });

  it("targets the last-focused row at its tracked selection and focuses it (H3, H13)", () => {
    const { result, setValue } = setup();
    const element = textarea("Bonjour");
    const binding = result.current.bindTarget("fr-FR");
    act(() => {
      binding.ref(element);
      binding.onFocus();
    });
    element.setSelectionRange(0, 0);
    act(() => binding.onSelect({ currentTarget: element } as never));
    expect(result.current.targetCulture).toBe("fr-FR");
    act(() => result.current.insert("Espace de travail "));
    expect(setValue).toHaveBeenCalledWith("fr-FR", "Espace de travail Bonjour");
    expect(document.activeElement).toBe(element);
    element.remove();
  });

  it("uses the range recorded on blur", () => {
    const { result, setValue } = setup();
    const element = textarea("Hallo Welt");
    const binding = result.current.bindTarget("de-DE");
    act(() => {
      binding.ref(element);
      binding.onFocus();
    });
    element.setSelectionRange(6, 10);
    act(() => binding.onBlur({ currentTarget: element } as never));
    act(() => result.current.insert("SELISE"));
    expect(setValue).toHaveBeenCalledWith("de-DE", "Hallo SELISE");
    element.remove();
  });
});
