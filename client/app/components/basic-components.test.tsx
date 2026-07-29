import { fireEvent, render, screen } from "@testing-library/react";
import { Wifi } from "lucide-react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorDisplay } from "@/components/error-display";
import { SearchInput } from "@/components/search-input/search-input";

describe("components/error-display", () => {
  it("should render the default alert icon without text", () => {
    const { container } = render(<ErrorDisplay />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.queryByText(/./)).toBeNull();
  });

  it("should render provided text and a custom icon", () => {
    render(<ErrorDisplay icon={Wifi} text="Offline" textClassName="t" />);
    expect(screen.getByText("Offline")).toBeTruthy();
  });
});

describe("components/error-boundary", () => {
  const Boom = () => {
    throw new Error("kaboom");
  };

  afterEach(() => vi.restoreAllMocks());

  it("should render children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>safe child</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("safe child")).toBeTruthy();
  });

  it("should render the default fallback with the error message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("kaboom")).toBeTruthy();
  });

  it("should render a custom fallback when provided", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("custom fallback")).toBeTruthy();
  });
});

describe("components/search-input", () => {
  const Harness = (props: Partial<React.ComponentProps<typeof SearchInput>>) => {
    const [value, setValue] = useState(props.value ?? "");
    const [visible, setVisible] = useState(props.isVisible ?? true);
    return (
      <SearchInput
        onSearch={(v) => {
          setValue(v);
          props.onSearch?.(v);
        }}
        value={value}
        isVisible={visible}
        setIsVisible={setVisible}
        toggleable={props.toggleable}
        placeholder={props.placeholder}
      />
    );
  };

  it("should show a toggle button when toggleable and hidden", () => {
    const { container } = render(<Harness toggleable isVisible={false} onSearch={vi.fn()} />);
    // Only the toggle button is rendered (no input).
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button")).toBeTruthy();
  });

  it("should reveal the input when the toggle button is clicked", () => {
    const { container } = render(<Harness toggleable isVisible={false} onSearch={vi.fn()} />);
    fireEvent.click(container.querySelector("button")!);
    expect(container.querySelector("input")).toBeTruthy();
  });

  it("should call onSearch when typing", () => {
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} placeholder="Find" />);
    fireEvent.change(screen.getByPlaceholderText("Find"), {
      target: { value: "abc" },
    });
    expect(onSearch).toHaveBeenCalledWith("abc");
  });

  it("should clear the value when the clear button is clicked", () => {
    const onSearch = vi.fn();
    render(<Harness value="preset" onSearch={onSearch} />);
    // The clear (X) button appears because value is non-empty.
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("should hide the input on clear when toggleable", () => {
    const { container } = render(<Harness value="preset" toggleable onSearch={vi.fn()} />);
    const buttons = container.querySelectorAll("button");
    fireEvent.click(buttons[buttons.length - 1]);
    // toggleable clear collapses back to the toggle button.
    expect(container.querySelector("input")).toBeNull();
  });
});
