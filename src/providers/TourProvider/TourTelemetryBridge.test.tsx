import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TourDefinition } from "@/components/Learn/tours/registry";

import { TourTelemetryBridge } from "./TourTelemetryBridge";

const track = vi.fn();
const recordCompletion = vi.fn(() => ({
  completionCount: 1,
  previouslyCompleted: false,
}));

let tourState: { currentStep: number };
let tour: TourDefinition | null;

vi.mock("@reactour/tour", () => ({
  useTour: () => tourState,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

vi.mock("./TourModeContext", () => ({
  useTourMode: () => (tour ? { tour } : null),
}));

vi.mock("./tourCompletion", () => ({
  useRecordTourCompletion: () => recordCompletion,
  useTourCompletions: () => ({ data: undefined }),
}));

const TOUR: TourDefinition = {
  id: "first-pipeline",
  steps: [
    { selector: "#a", content: "a", interaction: "add-task" },
    { selector: "#b", content: "b" },
    { selector: "#c", content: "c" },
  ],
};

function eventsOfType(type: string) {
  return track.mock.calls.filter(([actionType]) => actionType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  tour = TOUR;
  tourState = { currentStep: 0 };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("TourTelemetryBridge", () => {
  it("fires step_viewed once per step reached", () => {
    const { rerender } = render(<TourTelemetryBridge />);
    tourState = { currentStep: 1 };
    rerender(<TourTelemetryBridge />);
    tourState = { currentStep: 1 };
    rerender(<TourTelemetryBridge />);

    const steps = eventsOfType("learning_hub.tours.step_viewed");
    expect(steps).toHaveLength(2);
    expect(steps[0][1]).toMatchObject({
      tour_id: "first-pipeline",
      step_index: 0,
      step_count: 3,
      interaction: "add-task",
    });
    expect(steps[1][1]).toMatchObject({
      step_index: 1,
      interaction: undefined,
    });
  });

  it("marks completion and fires completed on reaching the last step", () => {
    const { rerender } = render(<TourTelemetryBridge />);
    tourState = { currentStep: 2 };
    rerender(<TourTelemetryBridge />);

    expect(recordCompletion).toHaveBeenCalledTimes(1);
    const completed = eventsOfType("learning_hub.tours.completed");
    expect(completed).toHaveLength(1);
    expect(completed[0][1]).toMatchObject({
      tour_id: "first-pipeline",
      step_count: 3,
      completion_count: 1,
    });
  });

  it("fires exited with furthest_step when unmounted before completing", () => {
    const { rerender, unmount } = render(<TourTelemetryBridge />);
    tourState = { currentStep: 1 };
    rerender(<TourTelemetryBridge />);
    unmount();

    const exited = eventsOfType("learning_hub.tours.exited");
    expect(exited).toHaveLength(1);
    expect(exited[0][1]).toMatchObject({
      tour_id: "first-pipeline",
      furthest_step: 1,
      step_count: 3,
      percent_complete: 67,
    });
  });

  it("does not fire exited when the tour completed", () => {
    const { rerender, unmount } = render(<TourTelemetryBridge />);
    tourState = { currentStep: 2 };
    rerender(<TourTelemetryBridge />);
    unmount();

    expect(eventsOfType("learning_hub.tours.exited")).toHaveLength(0);
  });
});
