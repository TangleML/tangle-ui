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

vi.mock("@/components/Home/ProjectsSection/SharedProjectsSection", () => ({
  SharedProjectsSection: () => <div data-testid="shared-projects" />,
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

  /** Your own work comes first; what you were invited into follows it. */
  it("puts the projects shared with you after your own", () => {
    render(<DashboardProjectsView />);

    const projects = screen.getByRole("heading", { name: "My Projects" });
    const shared = screen.getByTestId("shared-projects");

    expect(
      projects.compareDocumentPosition(shared) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
