import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingNavPill } from "./OnboardingNavPill";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

let onboarding = {
  steps: [],
  completedCount: 1,
  total: 4,
  shouldShowOnboarding: true,
  markDocsRead: vi.fn(),
};
vi.mock("@/providers/OnboardingProvider/OnboardingProvider", () => ({
  useOnboarding: () => onboarding,
}));

function resetState() {
  onboarding = {
    steps: [],
    completedCount: 1,
    total: 4,
    shouldShowOnboarding: true,
    markDocsRead: vi.fn(),
  };
}

beforeEach(resetState);
afterEach(cleanup);

const pill = () => screen.queryByText(/Onboarding/);

describe("OnboardingNavPill", () => {
  it("shows progress while onboarding should show", () => {
    render(<OnboardingNavPill />);
    expect(pill()).toHaveTextContent("Onboarding · 1/4");
  });

  it("is hidden when onboarding should not show", () => {
    onboarding.shouldShowOnboarding = false;
    render(<OnboardingNavPill />);
    expect(pill()).toBeNull();
  });
});
