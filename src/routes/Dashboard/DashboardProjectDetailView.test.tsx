import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardProjectDetailView } from "./DashboardProjectDetailView";

vi.mock("@/components/Project/ProjectPage", () => ({
  ProjectPage: () => <div data-testid="project-page" />,
}));

describe("DashboardProjectDetailView", () => {
  it("hands the route over to the project page", () => {
    render(<DashboardProjectDetailView />);

    expect(screen.getByTestId("project-page")).toBeInTheDocument();
  });
});
