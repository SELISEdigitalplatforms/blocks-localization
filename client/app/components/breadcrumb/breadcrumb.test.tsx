import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import PageBreadcrumb from "./breadcrumb";

const renderAt = (path: string, breadcrumbIndex?: number) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PageBreadcrumb breadcrumbIndex={breadcrumbIndex} />
    </MemoryRouter>,
  );

describe("components/breadcrumb", () => {
  it("should render the configured titles for a nested route", () => {
    renderAt("/app/abc/services/modules/mod-1");
    expect(screen.getByText("Language module")).toBeTruthy();
    expect(screen.getByText("Module")).toBeTruthy();
  });

  it("should render a link for non-terminal crumbs and a page for the last", () => {
    renderAt("/app/abc/services/modules/mod-1");
    // "Language module" is not the last crumb → rendered as a link.
    const link = screen.getByText("Language module").closest("a");
    expect(link).toBeTruthy();
    // "Module" is the terminal crumb → not a link.
    expect(screen.getByText("Module").closest("a")).toBeNull();
  });

  it("should slice crumbs when breadcrumbIndex is provided", () => {
    renderAt("/app/abc/services/modules/mod-1", 2);
    // Slicing from index 1 still keeps the module crumbs.
    expect(screen.getByText("Module")).toBeTruthy();
  });

  it("should render nothing meaningful for the root path", () => {
    const { container } = renderAt("/");
    // No crumbs → empty list.
    expect(container.querySelectorAll("li").length).toBe(0);
  });
});
