import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  const HIGHLIGHT = "ring-brand-accent/60";

  it("omits the projects nav item when the projects flag is disabled", () => {
    mockFlags({ projects: false, "tangent-shell": false });

    render(<DashboardLayout />);

    expect(screen.queryByRole("link", { name: /^Tangent/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Projects/ })).toBeNull();
  });

  describe("with Tangent", () => {
    beforeEach(() => {
      mockFlags({ projects: true, "tangent-shell": true });
    });

    it("links to the projects dashboard", () => {
      render(<DashboardLayout />);

      expect(screen.getByRole("link", { name: /^Tangent/ })).toHaveAttribute(
        "href",
        "/projects",
      );
    });

    /** The agent is the point of the product, so it is not filed behind the nouns. */
    it("leads the nav with Tangent", () => {
      render(<DashboardLayout />);

      expect(screen.getAllByRole("link")[0]).toHaveAccessibleName(/^Tangent/);
    });

    it("marks it out from everything else in the nav", () => {
      render(<DashboardLayout />);

      expect(
        screen.getByRole("link", { name: /^Tangent/ }).firstElementChild,
      ).toHaveClass(HIGHLIGHT);
      expect(
        screen.getByRole("link", { name: "My Dashboard" }).firstElementChild,
      ).not.toHaveClass(HIGHLIGHT);
    });
  });

  /**
   * Projects is a Tangle feature in its own right; Tangent is what turns it
   * into the agent. With Tangent off nothing should name it.
   */
  describe("without Tangent", () => {
    beforeEach(() => {
      mockFlags({ projects: true, "tangent-shell": false });
    });

    it("names the item Projects, pointing at the same page", () => {
      render(<DashboardLayout />);

      expect(screen.queryByRole("link", { name: /^Tangent/ })).toBeNull();
      expect(screen.getByRole("link", { name: /^Projects/ })).toHaveAttribute(
        "href",
        "/projects",
      );
    });

    it("files it with the other nav items rather than leading with it", () => {
      render(<DashboardLayout />);

      const labels = screen
        .getAllByRole("link")
        .map((link) => link.textContent ?? "");
      const projects = labels.findIndex((label) =>
        label.startsWith("Projects"),
      );

      expect(labels[projects - 1]).toMatch(/^All Runs/);
    });

    it("does not single it out", () => {
      render(<DashboardLayout />);

      expect(
        screen.getByRole("link", { name: /^Projects/ }).firstElementChild,
      ).not.toHaveClass(HIGHLIGHT);
    });
  });
});
