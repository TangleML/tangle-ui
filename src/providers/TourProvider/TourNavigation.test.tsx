import type { StepType } from "@reactour/tour";
import { act, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderNextButton,
  TourAutoAdvance,
  TourStepChecklist,
} from "./TourNavigation";
import { TourProgressProvider, useTourProgress } from "./TourProgressContext";

type TourState = {
  isOpen: boolean;
  currentStep: number;
  steps: unknown[];
  setCurrentStep: ReturnType<typeof vi.fn>;
};

let tourState: TourState;

vi.mock("@reactour/tour", () => ({
  useTour: () => tourState,
}));

function makeStep(overrides: Record<string, unknown>): StepType {
  return {
    selector: "body",
    content: "step",
    ...overrides,
  } as unknown as StepType;
}

function MarkComplete({ step }: { step: number }) {
  const { markStepComplete } = useTourProgress();
  useEffect(() => {
    markStepComplete(step);
  }, [step, markStepComplete]);
  return null;
}

type NavButtonProps = PropsWithChildren<{
  onClick?: () => void;
  kind?: "next" | "prev";
  hideArrow?: boolean;
  disabled?: boolean;
}>;

function FakeButton({ onClick, disabled, children }: NavButtonProps) {
  return (
    <button data-testid="next" onClick={onClick} disabled={disabled}>
      {children ?? "next"}
    </button>
  );
}

function renderNext(opts: {
  steps: StepType[];
  currentStep: number;
  complete?: number;
}) {
  const props = {
    Button: FakeButton,
    setCurrentStep: vi.fn(),
    stepsLength: opts.steps.length,
    currentStep: opts.currentStep,
    setIsOpen: vi.fn(),
    steps: opts.steps,
  };
  return render(
    <TourProgressProvider>
      {opts.complete !== undefined && <MarkComplete step={opts.complete} />}
      {renderNextButton(props as Parameters<typeof renderNextButton>[0])}
    </TourProgressProvider>,
  );
}

describe("TourStepChecklist", () => {
  it("renders a labeled row for an interactive step", () => {
    render(
      <TourProgressProvider>
        <TourStepChecklist
          step={makeStep({ interaction: "select-task" })}
          stepIndex={0}
        />
      </TourProgressProvider>,
    );
    expect(
      screen.getByText("Complete the highlighted action to continue"),
    ).toBeInTheDocument();
  });

  it("renders nothing for a non-interactive step", () => {
    const { container } = render(
      <TourProgressProvider>
        <TourStepChecklist step={makeStep({})} stepIndex={0} />
      </TourProgressProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("strikes through the label once the step is complete", () => {
    render(
      <TourProgressProvider>
        <MarkComplete step={1} />
        <TourStepChecklist
          step={makeStep({ interaction: "undock-window" })}
          stepIndex={1}
        />
      </TourProgressProvider>,
    );
    const label = screen.getByText(
      "Complete the highlighted action to continue",
    );
    expect(label.className).toContain("line-through");
  });
});

describe("renderNextButton gating", () => {
  it("disables Next on an interactive step that is not complete", () => {
    renderNext({
      steps: [makeStep({ interaction: "select-task" }), makeStep({})],
      currentStep: 0,
    });
    expect(screen.getByTestId("next")).toBeDisabled();
  });

  it("enables Next once the interactive step is complete", () => {
    renderNext({
      steps: [makeStep({ interaction: "select-task" }), makeStep({})],
      currentStep: 0,
      complete: 0,
    });
    expect(screen.getByTestId("next")).toBeEnabled();
  });

  it("enables Next on a non-interactive step", () => {
    renderNext({
      steps: [makeStep({}), makeStep({})],
      currentStep: 0,
    });
    expect(screen.getByTestId("next")).toBeEnabled();
  });

  it("hides the Next button on the last step", () => {
    const { container } = renderNext({
      steps: [makeStep({}), makeStep({ interaction: "select-task" })],
      currentStep: 1,
    });
    expect(container.querySelector("[aria-hidden]")).not.toBeNull();
  });
});

const progress: { markComplete: (step: number) => void } = {
  markComplete: () => undefined,
};
function CaptureProgress() {
  const { markStepComplete } = useTourProgress();
  useEffect(() => {
    progress.markComplete = markStepComplete;
  }, [markStepComplete]);
  return null;
}

function renderController(currentStep: number, stepCount = 3) {
  tourState = {
    isOpen: true,
    currentStep,
    steps: Array.from({ length: stepCount }, () => ({})),
    setCurrentStep: vi.fn(),
  };
  const tree = (
    <TourProgressProvider>
      <CaptureProgress />
      <TourAutoAdvance />
    </TourProgressProvider>
  );
  const result = render(tree);
  const navigateTo = (step: number) => {
    tourState = { ...tourState, currentStep: step };
    result.rerender(tree);
  };
  return { navigateTo };
}

describe("TourAutoAdvance", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("auto-advances after a fresh completion, once the delay elapses", () => {
    renderController(0);
    act(() => progress.markComplete(0));

    act(() => vi.advanceTimersByTime(500));
    expect(tourState.setCurrentStep).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(400));
    expect(tourState.setCurrentStep).toHaveBeenCalledTimes(1);
  });

  it("does not auto-advance a step that has not been completed", () => {
    renderController(0);
    act(() => vi.advanceTimersByTime(2000));
    expect(tourState.setCurrentStep).not.toHaveBeenCalled();
  });

  it("does not auto-advance the last step", () => {
    renderController(2, 3);
    act(() => progress.markComplete(2));
    act(() => vi.advanceTimersByTime(2000));
    expect(tourState.setCurrentStep).not.toHaveBeenCalled();
  });

  it("does not auto-advance a step already complete on arrival (revisit)", () => {
    const { navigateTo } = renderController(0);

    act(() => progress.markComplete(0));
    act(() => vi.advanceTimersByTime(900));
    expect(tourState.setCurrentStep).toHaveBeenCalledTimes(1);
    tourState.setCurrentStep.mockClear();

    // Navigate forward, then back to step 0 (which is already complete).
    act(() => navigateTo(1));
    act(() => navigateTo(0));
    act(() => vi.advanceTimersByTime(2000));
    expect(tourState.setCurrentStep).not.toHaveBeenCalled();
  });
});
