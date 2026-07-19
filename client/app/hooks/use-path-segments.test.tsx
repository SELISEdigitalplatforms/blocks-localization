import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import useRoutePathSegments from "@/hooks/use-path-segments";

const wrapperFor = (path: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries: [path] }, children);
  };

describe("hooks/use-path-segments", () => {
  it("should skip /app and dynamic id segments and title the language route", () => {
    const { result } = renderHook(() => useRoutePathSegments(), {
      wrapper: wrapperFor("/app/abc/services/language"),
    });
    expect(result.current).toEqual([
      {
        href: "/app/abc/services/language",
        label: "Language Translation Keys",
      },
    ]);
  });

  it("should title module list and dynamic module detail segments", () => {
    const { result } = renderHook(() => useRoutePathSegments(), {
      wrapper: wrapperFor("/app/abc/services/modules/mod-1"),
    });
    const labels = result.current.map((b) => b.label);
    expect(labels).toContain("Language module");
    expect(labels).toContain("Module");
  });

  it("should format non-configured segments by capitalizing hyphenated words", () => {
    const { result } = renderHook(() => useRoutePathSegments(), {
      wrapper: wrapperFor("/foo/bar-baz"),
    });
    expect(result.current).toEqual([
      { href: "/foo", label: "Foo" },
      { href: "/foo/bar-baz", label: "Bar Baz" },
    ]);
  });

  it("should return an empty list for the root path", () => {
    const { result } = renderHook(() => useRoutePathSegments(), {
      wrapper: wrapperFor("/"),
    });
    expect(result.current).toEqual([]);
  });
});
