import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/services/projects/useProjectInstructions", () => ({
  useProjectInstructions: () => ({
    instructions: "Retrain weekly",
    isPending: false,
    isSaving: false,
    save: vi.fn(),
  }),
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
  extraData: null,
};

function enableFlags(flags: Record<string, boolean>) {
  localStorage.setItem("betaFlags", JSON.stringify(flags));
}

function renderSidebar(overrides: Partial<Project> = {}) {
  return render(<ProjectSidebar project={{ ...project, ...overrides }} />);
}

describe("ProjectSidebar", () => {
  beforeEach(() => {
    enableFlags({ projects: true, "tangent-shell": true });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("names itself so its column lines up with the others", () => {
    renderSidebar();

    expect(
      screen.getByRole("complementary", { name: "Details" }),
    ).toBeInTheDocument();
  });

  it("holds the editable description and instructions", () => {
    renderSidebar();

    expect(screen.getByLabelText("Description")).toHaveValue(
      "Weekly churn scoring",
    );
    expect(screen.getByLabelText("Instructions")).toHaveValue("Retrain weekly");
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

  /** Instructions are standing context for agents, so they say nothing without one. */
  it("drops the instructions when Tangent is off", () => {
    enableFlags({ projects: true, "tangent-shell": false });
    renderSidebar();

    expect(screen.queryByLabelText("Instructions")).toBeNull();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });
});
