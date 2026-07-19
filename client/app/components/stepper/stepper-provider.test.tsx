import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StepperProvider, { useStepper } from "./stepper-provider";
import StepHorizontalTrackBar from "./horizontal-track-bar";
import StepVerticalTrackBar from "./vertical-track-bar";
import type { Steps } from "./stepper-models";

const steps: Steps = [
  { id: 1, title: "One" },
  { id: 2, title: "Two" },
  { id: 3, title: "Three" },
];

const Consumer = () => {
  const s = useStepper();
  return (
    <div>
      <span data-testid="current">{s.currentStep}</span>
      <span data-testid="completed">{s.completedSteps.join(",")}</span>
      <span data-testid="total">{s.totalSteps}</span>
      <span data-testid="steps">{s.getSteps().length}</span>
      <button onClick={s.nextStep}>next</button>
      <button onClick={s.previousStep}>prev</button>
      <button onClick={() => s.goToStep(3)}>goto3</button>
      <button onClick={() => s.goToStep(2)}>goto2</button>
    </div>
  );
};

const renderStepper = (initialStep?: number, isStepValid?: (n: number) => boolean) =>
  render(
    <StepperProvider steps={steps} initialStep={initialStep} isStepValid={isStepValid}>
      <Consumer />
    </StepperProvider>,
  );

describe("components/stepper/stepper-provider", () => {
  it("useStepper should throw outside a provider", () => {
    const Broken = () => {
      useStepper();
      return null;
    };
    expect(() => render(<Broken />)).toThrow(
      "useStepper must be used within a StepperProvider",
    );
  });

  it("should start at step 1 with no completed steps", () => {
    renderStepper();
    expect(screen.getByTestId("current").textContent).toBe("1");
    expect(screen.getByTestId("completed").textContent).toBe("");
    expect(screen.getByTestId("total").textContent).toBe("3");
    expect(screen.getByTestId("steps").textContent).toBe("3");
  });

  it("nextStep should advance and record completed steps", () => {
    renderStepper();
    fireEvent.click(screen.getByText("next"));
    expect(screen.getByTestId("current").textContent).toBe("2");
    expect(screen.getByTestId("completed").textContent).toBe("1");
  });

  it("nextStep should not advance past the last step", () => {
    renderStepper(3);
    fireEvent.click(screen.getByText("next"));
    expect(screen.getByTestId("current").textContent).toBe("3");
  });

  it("previousStep should go back and prune completed steps", () => {
    renderStepper(2);
    fireEvent.click(screen.getByText("prev"));
    expect(screen.getByTestId("current").textContent).toBe("1");
  });

  it("previousStep should not go below step 1", () => {
    renderStepper(1);
    fireEvent.click(screen.getByText("prev"));
    expect(screen.getByTestId("current").textContent).toBe("1");
  });

  it("goToStep should jump when the target is reachable", () => {
    renderStepper(3);
    fireEvent.click(screen.getByText("goto2"));
    expect(screen.getByTestId("current").textContent).toBe("2");
  });

  it("goToStep should refuse to skip ahead over incomplete steps", () => {
    renderStepper(1);
    fireEvent.click(screen.getByText("goto3"));
    expect(screen.getByTestId("current").textContent).toBe("1");
  });

  it("goToStep should respect isStepValid returning false", () => {
    renderStepper(3, () => false);
    fireEvent.click(screen.getByText("goto2"));
    expect(screen.getByTestId("current").textContent).toBe("3");
  });
});

describe("components/stepper/track bars", () => {
  const renderTrack = (Track: React.FC, initialStep = 2) =>
    render(
      <StepperProvider steps={steps} initialStep={initialStep}>
        <Track />
      </StepperProvider>,
    );

  it("horizontal track bar should render step titles and completed checks", () => {
    renderTrack(StepHorizontalTrackBar);
    expect(screen.getByText("One")).toBeTruthy();
    expect(screen.getByText("Two")).toBeTruthy();
    expect(screen.getByText("Three")).toBeTruthy();
    // Step 1 is completed at initialStep 2, so a check icon renders.
    expect(document.querySelector("svg.lucide-check")).toBeTruthy();
  });

  it("horizontal track bar should navigate to a completed step", () => {
    renderTrack(StepHorizontalTrackBar, 3);
    // Clicking the first step button jumps back.
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByText("One")).toBeTruthy();
  });

  it("vertical track bar should render step titles and connector lines", () => {
    const { container } = renderTrack(StepVerticalTrackBar);
    expect(screen.getByText("One")).toBeTruthy();
    expect(container.querySelector(".solid-line")).toBeTruthy();
  });

  it("vertical track bar should navigate on click", () => {
    renderTrack(StepVerticalTrackBar, 3);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByText("Two")).toBeTruthy();
  });
});
