import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IndexRedirect } from "./IndexRedirect";

vi.mock("@tanstack/react-router", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}));

let onboarding = { isReady: true, isComplete: false, dismissed: false };
vi.mock("@/providers/OnboardingProvider/OnboardingProvider", () => ({
  useOnboarding: () => onboarding,
}));

afterEach(cleanup);

const target = () => screen.queryByTestId("navigate");

describe("IndexRedirect", () => {
  it("waits (no redirect) until onboarding state is ready", () => {
    onboarding = { isReady: false, isComplete: false, dismissed: false };
    render(<IndexRedirect />);
    expect(target()).toBeNull();
  });

  it("redirects to /welcome while onboarding is active", () => {
    onboarding = { isReady: true, isComplete: false, dismissed: false };
    render(<IndexRedirect />);
    expect(target()).toHaveTextContent("/welcome");
  });

  it("redirects to /dashboard once complete", () => {
    onboarding = { isReady: true, isComplete: true, dismissed: false };
    render(<IndexRedirect />);
    expect(target()).toHaveTextContent("/dashboard");
  });

  it("redirects to /dashboard once dismissed", () => {
    onboarding = { isReady: true, isComplete: false, dismissed: true };
    render(<IndexRedirect />);
    expect(target()).toHaveTextContent("/dashboard");
  });
});
