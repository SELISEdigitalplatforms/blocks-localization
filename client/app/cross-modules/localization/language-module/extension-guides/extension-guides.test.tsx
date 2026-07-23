import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExtensionGuides } from "./extension-guides";

const { getRuntimeEnvMock } = vi.hoisted(() => ({
  getRuntimeEnvMock: vi.fn(),
}));

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: getRuntimeEnvMock,
}));

describe("ExtensionGuides", () => {
  beforeEach(() => {
    getRuntimeEnvMock.mockImplementation((key: string) => {
      if (key === "BLOCKS_PUBLIC_API_BASE_URL") {
        return "https://runtime-api.example.com";
      }
      if (key === "BLOCKS_X_BLOCKS_KEY") {
        return "runtime-blocks-key";
      }
      return "";
    });
  });

  it("displays the API Base URL and X-Blocks-Key from runtime configuration", () => {
    render(<ExtensionGuides />);

    expect(screen.getByText("https://runtime-api.example.com")).toBeTruthy();
    expect(screen.getByText("runtime-blocks-key")).toBeTruthy();
    expect(getRuntimeEnvMock).toHaveBeenCalledWith(
      "BLOCKS_PUBLIC_API_BASE_URL",
    );
    expect(getRuntimeEnvMock).toHaveBeenCalledWith("BLOCKS_X_BLOCKS_KEY");
  });
});
