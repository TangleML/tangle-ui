import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardProjectsView } from "./DashboardProjectsView";

vi.mock("@tanstack/react-router", () => ({ Link: () => null }));

vi.mock("@/components/Home/ProjectsSection/ProjectsSection", () => ({
  ProjectsSection: () => null,
}));

vi.mock("@/components/Home/ProjectsSection/StartSessionPrompt", () => ({
  StartSessionPrompt: () => <input aria-label="Start a new session" />,
}));

vi.mock("@/components/Home/ProjectsSection/PinnedProjectsSection", () => ({
  PinnedProjectsSection: () => <div data-testid="pinned-projects" />,
}));

describe("DashboardProjectsView", () => {
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
      screen.getByRole("heading", { level: 2, name: "My Projects" }),
    ).toBeInTheDocument();
  });

  it("puts starting a session ahead of the list", () => {
    render(<DashboardProjectsView />);

    const prompt = screen.getByLabelText("Start a new session");
    const projects = screen.getByRole("heading", { name: "My Projects" });

    expect(
      prompt.compareDocumentPosition(projects) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  /** Pinning is a request to have it to hand, so it goes above the list. */
  it("puts the pinned projects above the full list", () => {
    render(<DashboardProjectsView />);

    const pinnedSection = screen.getByTestId("pinned-projects");
    const projects = screen.getByRole("heading", { name: "My Projects" });

    expect(
      pinnedSection.compareDocumentPosition(projects) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
