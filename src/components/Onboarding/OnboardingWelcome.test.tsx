import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingWelcome } from "./OnboardingWelcome";

vi.mock("@tanstack/react-router", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/components/Learn/OnboardingHero", () => ({
  OnboardingHero: () => <div data-testid="hero" />,
}));

let onboarding = { isResolved: true, shouldShowOnboarding: true };
vi.mock("@/providers/OnboardingProvider/OnboardingProvider", () => ({
  useOnboarding: () => onboarding,
}));

afterEach(cleanup);

describe("OnboardingWelcome", () => {
  it("shows a spinner until onboarding state is resolved", () => {
    onboarding = { isResolved: false, shouldShowOnboarding: false };
    render(<OnboardingWelcome />);
    expect(screen.queryByTestId("hero")).toBeNull();
    expect(screen.queryByTestId("navigate")).toBeNull();
  });

  it("renders the welcome hero when onboarding should show", () => {
    onboarding = { isResolved: true, shouldShowOnboarding: true };
    render(<OnboardingWelcome />);
    expect(screen.getByTestId("hero")).toBeInTheDocument();
  });

  it("redirects to /dashboard when onboarding should not show", () => {
    onboarding = { isResolved: true, shouldShowOnboarding: false };
    render(<OnboardingWelcome />);
    expect(screen.getByTestId("navigate")).toHaveTextContent("/dashboard");
  });
});
