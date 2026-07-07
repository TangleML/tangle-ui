import { describe, expect, it } from "vitest";

import {
  completedStepIds,
  newlyCompletedIds,
  stepLabel,
} from "./onboardingCompletion";
import { ONBOARDING_STEPS } from "./steps";

describe("completedStepIds", () => {
  it("returns completed ids in canonical order", () => {
    expect(
      completedStepIds({
        read_docs: true,
        complete_tour: false,
        create_pipeline: true,
        execute_run: false,
      }),
    ).toEqual(["read_docs", "create_pipeline"]);
  });

  it("returns an empty array when nothing is complete", () => {
    expect(
      completedStepIds({
        read_docs: false,
        complete_tour: false,
        create_pipeline: false,
        execute_run: false,
      }),
    ).toEqual([]);
  });
});

describe("newlyCompletedIds", () => {
  it("returns ids present in current but not previous", () => {
    expect(
      newlyCompletedIds(
        new Set(["read_docs"]),
        new Set(["read_docs", "execute_run"]),
      ),
    ).toEqual(["execute_run"]);
  });

  it("returns empty when nothing newly completed", () => {
    expect(
      newlyCompletedIds(new Set(["read_docs"]), new Set(["read_docs"])),
    ).toEqual([]);
  });
});

describe("stepLabel", () => {
  it("resolves the label for a known step", () => {
    expect(stepLabel("read_docs")).toBe(
      ONBOARDING_STEPS.find((step) => step.id === "read_docs")?.label,
    );
  });
});
