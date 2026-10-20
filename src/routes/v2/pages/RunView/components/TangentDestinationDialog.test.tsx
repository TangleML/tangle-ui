import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectSummary, Workspace } from "@/services/projects/types";
import { useReachableProjects } from "@/services/projects/useReachableProjects";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { TangentDestinationDialog } from "./TangentDestinationDialog";

vi.mock("@/services/projects/useReachableProjects", () => ({
  useReachableProjects: vi.fn(),
}));

vi.mock("@/services/projects/useWorkspaces", () => ({
  useWorkspaces: vi.fn(),
}));

const onChoose = vi.fn();
const onDismiss = vi.fn();

const workspace = (id: string, name: string, createdAt: string): Workspace => ({
  id,
  name,
  description: null,
  isActive: true,
  metadata: null,
  createdAt: new Date(createdAt),
});

const research = workspace("ws-1", "Research", "2026-01-01T00:00:00Z");
const analytics = workspace("ws-2", "Analytics", "2026-06-01T00:00:00Z");

const project = (
  id: string,
  name: string,
  workspaceId = "ws-1",
): ProjectSummary => ({
  id,
  workspaceId,
  name,
  description: null,
  createdBy: null,
  origin: "user",
  metadata: null,
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-09T10:00:00Z"),
  resourceCounts: {},
});

function given({
  reachable = [] as ProjectSummary[],
  workspaces = [analytics, research] as Workspace[],
} = {}) {
  vi.mocked(useReachableProjects).mockReturnValue({
    projects: reachable,
    isPending: false,
    error: null,
  });
  vi.mocked(useWorkspaces).mockReturnValue({
    data: workspaces,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useWorkspaces>);
}

function openDialog(attributed: ProjectSummary[] = []) {
  const user = userEvent.setup();
  render(
    <TangentDestinationDialog
      title="Debug in Tangent"
      attributed={attributed}
      newProjectName="Debug: Churn"
      onChoose={onChoose}
      onDismiss={onDismiss}
    />,
  );
  return user;
}

const option = (name: RegExp | string) => screen.getByRole("button", { name });
const newProject = () => option("New project");
const confirmButton = () => option("Confirm");

describe("TangentDestinationDialog", () => {
  beforeEach(() => {
    // jsdom implements neither, and Radix's select calls both while opening.
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    given({ reachable: [project("project-1", "Churn model")] });
  });

  afterEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("works in the project picked once it is confirmed", async () => {
    const user = openDialog();

    await user.click(option(/Churn model/));
    expect(onChoose).not.toHaveBeenCalled();
    await user.click(confirmButton());

    expect(onChoose).toHaveBeenCalledWith({
      kind: "existing",
      projectId: "project-1",
    });
  });

  it("marks the row that is picked", async () => {
    const user = openDialog();

    await user.click(option(/Churn model/));

    expect(option(/Churn model/)).toHaveAttribute("aria-pressed", "true");
    expect(newProject()).toHaveAttribute("aria-pressed", "false");
  });

  it("confirms nothing until something is picked", () => {
    openDialog();

    expect(confirmButton()).toBeDisabled();
  });

  it("lets go of a pick that is clicked again", async () => {
    const user = openDialog();

    await user.click(option(/Churn model/));
    await user.click(option(/Churn model/));

    expect(confirmButton()).toBeDisabled();
  });

  it("offers the run's own projects first, and only once", () => {
    given({
      reachable: [
        project("project-1", "Mine"),
        project("project-2", "Run's and mine"),
      ],
    });
    openDialog([
      project("project-3", "Run's"),
      project("project-2", "Run's and mine"),
    ]);

    expect(
      screen
        .getAllByRole("button", { pressed: false })
        .map((button) => button.textContent),
    ).toEqual(["Run's", "Run's and mine", "Mine", "New project"]);
  });

  it("narrows the projects to what is searched for", async () => {
    given({
      reachable: [
        project("project-1", "Churn model"),
        project("project-2", "Forecast"),
      ],
    });
    const user = openDialog();

    await user.type(screen.getByLabelText("Search projects"), "churn");

    expect(option(/Churn model/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Forecast/ })).toBeNull();
  });

  /** Confirming a project that is no longer on screen would be a surprise. */
  it("forgets a pick the search has hidden", async () => {
    const user = openDialog();

    await user.click(option(/Churn model/));
    await user.type(screen.getByLabelText("Search projects"), "forecast");

    expect(confirmButton()).toBeDisabled();
  });

  it("names each project's workspace only when they are not all in one", () => {
    given({
      reachable: [
        project("project-1", "Churn model", "ws-1"),
        project("project-2", "Forecast", "ws-2"),
      ],
    });
    openDialog();

    expect(option(/Churn model/)).toHaveTextContent("Research");
    expect(option(/Forecast/)).toHaveTextContent("Analytics");
  });

  it("leaves the workspace off when every project shares one", () => {
    openDialog();

    expect(option(/Churn model/)).not.toHaveTextContent("Research");
  });

  it("goes nowhere when cancelled", async () => {
    const user = openDialog();

    await user.click(option("Cancel"));

    expect(onDismiss).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  describe("a new project", () => {
    it("asks for nothing until it is picked", () => {
      openDialog();

      expect(screen.queryByLabelText("Name")).toBeNull();
      expect(screen.queryByLabelText("Workspace")).toBeNull();
    });

    it("asks for a name and workspace once picked", async () => {
      const user = openDialog();

      await user.click(newProject());

      expect(newProject()).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByLabelText("Name")).toHaveValue("Debug: Churn");
      expect(screen.getByLabelText("Workspace")).toBeInTheDocument();
    });

    it("puts the questions away again when a project is picked instead", async () => {
      const user = openDialog();

      await user.click(newProject());
      await user.click(option(/Churn model/));

      expect(screen.queryByLabelText("Name")).toBeNull();
      await user.click(confirmButton());
      expect(onChoose).toHaveBeenCalledWith({
        kind: "existing",
        projectId: "project-1",
      });
    });

    it("puts them away when it is clicked again", async () => {
      const user = openDialog();

      await user.click(newProject());
      await user.click(newProject());

      expect(screen.queryByLabelText("Name")).toBeNull();
      expect(confirmButton()).toBeDisabled();
    });

    it("keeps the name typed when picked a second time", async () => {
      const user = openDialog();

      await user.click(newProject());
      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Why run-7 failed");
      await user.click(option(/Churn model/));
      await user.click(newProject());

      expect(screen.getByLabelText("Name")).toHaveValue("Why run-7 failed");
    });

    it("is what is on offer when there are no projects to pick", () => {
      given();
      openDialog();

      expect(newProject()).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
    });

    it("is named for what it is for unless renamed", async () => {
      const user = openDialog();

      await user.click(newProject());
      await user.click(confirmButton());

      expect(onChoose).toHaveBeenCalledWith({
        kind: "new",
        workspaceId: "ws-1",
        name: "Debug: Churn",
      });
    });

    it("takes the name it is given", async () => {
      const user = openDialog();

      await user.click(newProject());
      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "  Why run-7 failed ");
      await user.click(confirmButton());

      expect(onChoose).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Why run-7 failed" }),
      );
    });

    it("cannot be confirmed without a name", async () => {
      const user = openDialog();

      await user.click(newProject());
      await user.clear(screen.getByLabelText("Name"));

      expect(confirmButton()).toBeDisabled();
    });

    it("goes in the workspace that was picked", async () => {
      const user = openDialog();

      await user.click(newProject());
      await user.click(screen.getByLabelText("Workspace"));
      await user.click(screen.getByRole("option", { name: "Analytics" }));
      await user.click(confirmButton());

      expect(onChoose).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "ws-2" }),
      );
    });

    it("cannot be confirmed when no workspace takes new projects", async () => {
      given({
        reachable: [project("project-1", "Churn model")],
        workspaces: [],
      });
      const user = openDialog();

      await user.click(newProject());

      expect(confirmButton()).toBeDisabled();
      expect(
        screen.getByText(/Projects cannot be created yet/),
      ).toBeInTheDocument();
    });
  });
});
