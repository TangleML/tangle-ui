import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Project } from "@/services/projects/types";
import { formatDate } from "@/utils/date";

import { ProjectSidebar } from "./ProjectSidebar";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useDeleteProject: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => vi.fn(),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

const project: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Churn model",
  description: "Weekly churn scoring",
  createdBy: "alice@example.com",
  origin: "user",
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-15T10:00:00Z"),
  resourceCounts: { pipeline: 1 },
  notes: "Retrain weekly",
};

function renderSidebar(overrides: Partial<Project> = {}) {
  return render(<ProjectSidebar project={{ ...project, ...overrides }} />);
}

describe("ProjectSidebar", () => {
  it("names itself so its column lines up with the others", () => {
    renderSidebar();

    expect(
      screen.getByRole("complementary", { name: "About" }),
    ).toBeInTheDocument();
  });

  it("holds the editable description and notes", () => {
    renderSidebar();

    expect(screen.getByLabelText("Description")).toHaveValue(
      "Weekly churn scoring",
    );
    expect(screen.getByLabelText("Notes")).toHaveValue("Retrain weekly");
  });

  it("says who made the project and when", () => {
    renderSidebar();

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText(formatDate(project.createdAt))).toBeInTheDocument();
  });

  it("names an unattributed project's author rather than leaving a gap", () => {
    renderSidebar({ createdBy: null });

    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("gathers the project's actions in one place", () => {
    renderSidebar();

    expect(
      screen.getByRole("button", { name: "Rename project" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Share project" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete project" }),
    ).toBeInTheDocument();
  });

  it("never names the workspace a project sits in", () => {
    renderSidebar();

    expect(screen.queryByText(/workspace/i)).toBeNull();
  });
});
