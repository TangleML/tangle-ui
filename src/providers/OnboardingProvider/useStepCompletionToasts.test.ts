import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stepLabel } from "./onboardingCompletion";
import type { OnboardingSteps } from "./onboardingProgress";
import { useStepCompletionToasts } from "./useStepCompletionToasts";

const notify = vi.fn();

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

const NONE: OnboardingSteps = {
  read_docs: false,
  complete_tour: false,
  create_pipeline: false,
  execute_run: false,
};

const CREATED: OnboardingSteps = { ...NONE, create_pipeline: true };

const createdLabel = `Completed: ${stepLabel("create_pipeline")}`;

function setup(initial: {
  isOnboardingAvailable: boolean;
  desiredSteps: OnboardingSteps;
  isComplete?: boolean;
}) {
  return renderHook((props) => useStepCompletionToasts(props), {
    initialProps: {
      isOnboardingAvailable: initial.isOnboardingAvailable,
      desiredSteps: initial.desiredSteps,
      isComplete: initial.isComplete ?? false,
    },
  });
}

beforeEach(() => {
  notify.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useStepCompletionToasts", () => {
  it("does not toast for steps already complete when the baseline seeds", () => {
    setup({ isOnboardingAvailable: true, desiredSteps: CREATED });
    expect(notify).not.toHaveBeenCalled();
  });

  it("toasts once when a step flips to complete", () => {
    const { rerender } = setup({
      isOnboardingAvailable: true,
      desiredSteps: NONE,
    });
    rerender({
      isOnboardingAvailable: true,
      desiredSteps: { ...CREATED },
      isComplete: false,
    });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(createdLabel, "success");
  });

  it("does not re-toast when a completed step reverts and completes again", () => {
    const { rerender } = setup({
      isOnboardingAvailable: true,
      desiredSteps: NONE,
    });
    rerender({
      isOnboardingAvailable: true,
      desiredSteps: { ...CREATED },
      isComplete: false,
    });
    rerender({
      isOnboardingAvailable: true,
      desiredSteps: { ...NONE },
      isComplete: false,
    });
    rerender({
      isOnboardingAvailable: true,
      desiredSteps: { ...CREATED },
      isComplete: false,
    });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("does not re-toast after availability flaps and the step recompletes", () => {
    const { rerender } = setup({
      isOnboardingAvailable: true,
      desiredSteps: NONE,
    });
    rerender({
      isOnboardingAvailable: true,
      desiredSteps: { ...CREATED },
      isComplete: false,
    });
    rerender({
      isOnboardingAvailable: false,
      desiredSteps: { ...NONE },
      isComplete: false,
    });
    rerender({
      isOnboardingAvailable: true,
      desiredSteps: { ...CREATED },
      isComplete: false,
    });
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
