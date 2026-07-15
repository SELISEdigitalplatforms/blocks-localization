import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  reducer,
  showErrorToast,
  showInfoToast,
  showSuccessToast,
  toast,
  useToast,
} from "@/hooks/use-toast";

const makeToast = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  open: true,
  ...extra,
});

describe("hooks/use-toast", () => {
  afterEach(() => {
    // Drop any fake timers scheduled by DISMISS_TOAST's remove queue.
    vi.useRealTimers();
  });

  describe("reducer", () => {
    it("ADD_TOAST should prepend and cap to the toast limit of 1", () => {
      const state = reducer(
        { toasts: [makeToast("1") as never] },
        { type: "ADD_TOAST", toast: makeToast("2") as never },
      );
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].id).toBe("2");
    });

    it("UPDATE_TOAST should patch the matching toast", () => {
      const state = reducer(
        { toasts: [makeToast("1", { title: "old" }) as never] },
        { type: "UPDATE_TOAST", toast: { id: "1", title: "new" } as never },
      );
      expect(state.toasts[0].title).toBe("new");
    });

    it("UPDATE_TOAST should leave non-matching toasts untouched", () => {
      const state = reducer(
        { toasts: [makeToast("1", { title: "keep" }) as never] },
        { type: "UPDATE_TOAST", toast: { id: "2", title: "x" } as never },
      );
      expect(state.toasts[0].title).toBe("keep");
    });

    it("DISMISS_TOAST with an id should close only that toast", () => {
      vi.useFakeTimers();
      const state = reducer(
        {
          toasts: [
            makeToast("1") as never,
            makeToast("2") as never,
          ],
        },
        { type: "DISMISS_TOAST", toastId: "1" },
      );
      expect(state.toasts.find((t) => t.id === "1")?.open).toBe(false);
      expect(state.toasts.find((t) => t.id === "2")?.open).toBe(true);
    });

    it("DISMISS_TOAST without an id should close all toasts", () => {
      vi.useFakeTimers();
      const state = reducer(
        { toasts: [makeToast("1") as never, makeToast("2") as never] },
        { type: "DISMISS_TOAST" },
      );
      expect(state.toasts.every((t) => t.open === false)).toBe(true);
    });

    it("REMOVE_TOAST with an id should drop only that toast", () => {
      const state = reducer(
        { toasts: [makeToast("1") as never, makeToast("2") as never] },
        { type: "REMOVE_TOAST", toastId: "1" },
      );
      expect(state.toasts.map((t) => t.id)).toEqual(["2"]);
    });

    it("REMOVE_TOAST without an id should clear all toasts", () => {
      const state = reducer(
        { toasts: [makeToast("1") as never] },
        { type: "REMOVE_TOAST", toastId: undefined },
      );
      expect(state.toasts).toEqual([]);
    });
  });

  describe("toast()", () => {
    it("should return an id plus dismiss/update handlers and push into state", () => {
      const { result } = renderHook(() => useToast());
      let handle: ReturnType<typeof toast>;
      act(() => {
        handle = toast({ title: "Hi", description: "there" });
      });
      expect(handle!.id).toBeTruthy();
      expect(typeof handle!.dismiss).toBe("function");
      expect(result.current.toasts[0].title).toBe("Hi");
    });

    it("update() should modify the live toast", () => {
      const { result } = renderHook(() => useToast());
      let handle: ReturnType<typeof toast>;
      act(() => {
        handle = toast({ description: "d" });
      });
      act(() => {
        handle!.update({ id: handle!.id, title: "updated" } as never);
      });
      expect(result.current.toasts[0].title).toBe("updated");
    });

    it("onOpenChange(false) should dismiss", () => {
      const { result } = renderHook(() => useToast());
      act(() => {
        toast({ description: "d" });
      });
      act(() => {
        result.current.toasts[0].onOpenChange?.(false);
      });
      expect(result.current.toasts[0].open).toBe(false);
    });
  });

  describe("show* helpers", () => {
    it("showSuccessToast should push a success variant", () => {
      const { result } = renderHook(() => useToast());
      act(() => showSuccessToast({ description: "done" }));
      expect(result.current.toasts[0]).toMatchObject({
        variant: "success",
        title: "Success",
        description: "done",
      });
    });

    it("showInfoToast should push an info variant", () => {
      const { result } = renderHook(() => useToast());
      act(() => showInfoToast({ description: "fyi" }));
      expect(result.current.toasts[0]).toMatchObject({
        variant: "info",
        title: "Info",
      });
    });

    it("showErrorToast should render a string message", () => {
      const { result } = renderHook(() => useToast());
      act(() => showErrorToast({ errors: "boom" }));
      expect(result.current.toasts[0]).toMatchObject({
        variant: "destructive",
        title: "Failed",
        description: "boom",
      });
    });

    it("showErrorToast should render an array message as nodes", () => {
      const { result } = renderHook(() => useToast());
      act(() => showErrorToast({ errors: { a: "x", b: "y" } }));
      // getErrorMessage returns ["x", "y"] → mapped to <div> nodes.
      expect(Array.isArray(result.current.toasts[0].description)).toBe(true);
    });
  });

  describe("useToast()", () => {
    it("dismiss(id) should close the toast", () => {
      const { result } = renderHook(() => useToast());
      let handle: ReturnType<typeof toast>;
      act(() => {
        handle = toast({ description: "d" });
      });
      act(() => {
        result.current.dismiss(handle!.id);
      });
      expect(result.current.toasts[0].open).toBe(false);
    });
  });
});
