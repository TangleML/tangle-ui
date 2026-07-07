import { describe, expect, it } from "vitest";

import { ONBOARDING_STEP_IDS, ONBOARDING_STEPS } from "./steps";

describe("onboarding steps", () => {
  it("defines exactly one step per id, in canonical order", () => {
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([
      ...ONBOARDING_STEP_IDS,
    ]);
  });

  it("gives every step the metadata the UI needs", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.label).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.icon).toBeTruthy();
      expect(step.cta.label).toBeTruthy();
      expect(step.cta.to).toBeTruthy();
    }
  });
});
