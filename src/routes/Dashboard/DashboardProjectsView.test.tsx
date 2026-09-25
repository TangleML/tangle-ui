import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFlagValue } from "@/components/shared/Settings/useFlags";

import { DashboardProjectsView } from "./DashboardProjectsView";

vi.mock("@tanstack/react-router", () => ({ Link: () => null }));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: vi.fn(),
}));

vi.mock("@/components/Home/ProjectsSection/ProjectsSection", () => ({
  ProjectsSection: () => null,
}));

vi.mock("@/components/Home/ProjectsSection/StartSessionPrompt", () => ({
  StartSessionPrompt: () => <input aria-label="Start a new session" />,
}));

function mockFlags(flags: Record<string, boolean>) {
  vi.mocked(useFlagValue).mockImplementation((flag) => flags[flag] ?? false);
}

describe("DashboardProjectsView", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("with Tangent", () => {
    beforeEach(() => {
      mockFlags({ "tangent-shell": true });
    });

    /**
     * The page is where you go to work with an agent; the list of projects that
     * work leaves behind is a part of it, not the point of it.
     */
    it("presents itself as Tangent, with the projects below", () => {
      render(<DashboardProjectsView />);

      expect(
        screen.getByRole("heading", { level: 1, name: "Tangent" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: "Projects" }),
      ).toBeInTheDocument();
    });

    it("puts starting a session ahead of the list", () => {
      render(<DashboardProjectsView />);

      const prompt = screen.getByLabelText("Start a new session");
      const projects = screen.getByRole("heading", { name: "Projects" });

      expect(
        prompt.compareDocumentPosition(projects) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  /** Without the agent there is no session to start, and nothing to start it from. */
  describe("without Tangent", () => {
    beforeEach(() => {
      mockFlags({ "tangent-shell": false });
    });

    it("presents itself as Projects", () => {
      render(<DashboardProjectsView />);

      expect(
        screen.getByRole("heading", { level: 1, name: "Projects" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Tangent")).toBeNull();
    });

    it("offers no way to start a session", () => {
      render(<DashboardProjectsView />);

      expect(screen.queryByLabelText("Start a new session")).toBeNull();
      expect(screen.queryByText("What should we build?")).toBeNull();
    });
  });
});
