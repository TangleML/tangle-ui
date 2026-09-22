import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFlagValue } from "@/components/shared/Settings/useFlags";

import { DashboardLayout } from "./DashboardLayout";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({
    to,
    children,
  }: {
    to: string;
    children: ReactNode | ((props: { isActive: boolean }) => ReactNode);
  }) => (
    <a href={to}>
      {typeof children === "function"
        ? children({ isActive: false })
        : children}
    </a>
  ),
  Outlet: () => null,
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: vi.fn(),
}));

vi.mock("@/providers/OnboardingProvider/OnboardingProvider", () => ({
  useOnboarding: () => ({ shouldShowOnboarding: false }),
}));

vi.mock("@/components/shared/Authentication/helpers", () => ({
  isAuthorizationRequired: () => false,
}));

vi.mock("@/components/Learn/TipOfTheDay", () => ({
  TipOfTheDay: () => null,
}));

vi.mock("@/routes/Dashboard/ExtraNavItems", () => ({
  ExtraNavItems: () => null,
}));

function mockFlags(flags: Record<string, boolean>) {
  vi.mocked(useFlagValue).mockImplementation((flag) => flags[flag] ?? false);
}

describe("DashboardLayout", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("links to the projects dashboard when the projects flag is enabled", () => {
    mockFlags({ projects: true });

    render(<DashboardLayout />);

    expect(screen.getByRole("link", { name: /^Tangent/ })).toHaveAttribute(
      "href",
      "/projects",
    );
  });

  it("omits the projects nav item when the projects flag is disabled", () => {
    mockFlags({ projects: false });

    render(<DashboardLayout />);

    expect(screen.queryByRole("link", { name: /^Tangent/ })).toBeNull();
  });

  /** The agent is the point of the product, so it is not filed behind the nouns. */
  it("leads the nav with Tangent", () => {
    mockFlags({ projects: true });

    render(<DashboardLayout />);

    expect(screen.getAllByRole("link")[0]).toHaveAccessibleName(/^Tangent/);
  });

  it("marks it out from everything else in the nav", () => {
    mockFlags({ projects: true });

    render(<DashboardLayout />);

    const highlight = "ring-brand-accent/60";
    expect(
      screen.getByRole("link", { name: /^Tangent/ }).firstElementChild,
    ).toHaveClass(highlight);
    expect(
      screen.getByRole("link", { name: "My Dashboard" }).firstElementChild,
    ).not.toHaveClass(highlight);
  });
});
