import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LanguageLogs } from "./language-logs";

vi.mock("../localization-timeline/localization-timeline", () => ({
  default: ({ cardTitle }: { cardTitle: string }) => <div>{cardTitle}</div>,
}));

describe("language-module/language-logs", () => {
  it("should render the activity log timeline", () => {
    render(
      <MemoryRouter initialEntries={["/app/abc/services/language/logs"]}>
        <LanguageLogs />
      </MemoryRouter>,
    );
    expect(screen.getByText("Activity log")).toBeTruthy();
  });
});
