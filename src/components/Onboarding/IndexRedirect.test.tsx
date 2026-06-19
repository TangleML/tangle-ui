import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IndexRedirect } from "./IndexRedirect";

vi.mock("@tanstack/react-router", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}));

let onboarding = { isResolved: true, shouldShowOnboarding: true };
vi.mock("@/providers/OnboardingProvider/OnboardingProvider", () => ({
  useOnboarding: () => onboarding,
}));

afterEach(cleanup);

const target = () => screen.queryByTestId("navigate");

describe("IndexRedirect", () => {
  it("waits (no redirect) until onboarding state is resolved", () => {
    onboarding = { isResolved: false, shouldShowOnboarding: false };
    render(<IndexRedirect />);
    expect(target()).toBeNull();
  });

  it("redirects to /welcome while onboarding should show", () => {
    onboarding = { isResolved: true, shouldShowOnboarding: true };
    render(<IndexRedirect />);
    expect(target()).toHaveTextContent("/welcome");
  });

  it("redirects to /dashboard when onboarding should not show", () => {
    onboarding = { isResolved: true, shouldShowOnboarding: false };
    render(<IndexRedirect />);
    expect(target()).toHaveTextContent("/dashboard");
  });
});
