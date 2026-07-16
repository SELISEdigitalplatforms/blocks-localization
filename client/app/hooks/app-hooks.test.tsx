import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import useIsMobile from "@/hooks/use-is-mobile";
import usePopoverWidth from "@/hooks/use-popover-width";
import useIsServiceBarOpenLocal from "@blocks-localization/hooks/use-is-service-tab-open-local";

const setWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
};

describe("hooks/use-is-mobile", () => {
  afterEach(() => setWidth(1024));

  it("should report mobile when width is at/under the breakpoint", () => {
    setWidth(500);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("should report not-mobile when width is above the breakpoint", () => {
    setWidth(1200);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("should react to resize events", () => {
    setWidth(1200);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => {
      setWidth(400);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(true);
  });

  it("should honor a custom breakpoint", () => {
    setWidth(900);
    const { result } = renderHook(() => useIsMobile(1000));
    expect(result.current).toBe(true);
  });
});

describe("hooks/use-is-service-tab-open-local", () => {
  afterEach(() => setWidth(1400));

  it("should open when width is at/under 1134", () => {
    setWidth(1000);
    const { result } = renderHook(() => useIsServiceBarOpenLocal());
    expect(result.current).toBe(true);
  });

  it("should be closed on wide screens", () => {
    setWidth(1400);
    const { result } = renderHook(() => useIsServiceBarOpenLocal());
    expect(result.current).toBe(false);
  });
});

describe("hooks/use-popover-width", () => {
  it("should return a ref and an undefined width before the button mounts", () => {
    const { result } = renderHook(() => usePopoverWidth());
    const [ref, width] = result.current;
    expect(ref).toHaveProperty("current");
    expect(width).toBeUndefined();
  });

  it("should measure offsetWidth when the ref points at an element", () => {
    const { result, rerender } = renderHook(() => usePopoverWidth());
    const [ref] = result.current;
    const button = document.createElement("button");
    Object.defineProperty(button, "offsetWidth", {
      configurable: true,
      value: 240,
    });
    (ref as { current: HTMLButtonElement | null }).current = button;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    rerender();
    expect(result.current[1]).toBe(240);
  });
});
