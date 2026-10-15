import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rememberLastUsedWorkspace } from "@/services/projects/defaultWorkspace";
import type { ProjectSummary, Workspace } from "@/services/projects/types";
import { useReachableProjects } from "@/services/projects/useReachableProjects";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { TangentDestinationDialog } from "./TangentDestinationDialog";

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

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
): ProjectSummary => ({ id, name, workspaceId }) as unknown as ProjectSummary;

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
      createLabel="Create and debug"
      attributed={attributed}
      newProjectName="Debug: Churn"
      onChoose={onChoose}
      onDismiss={onDismiss}
    />,
  );
  return user;
}

const button = (name: string) => screen.getByRole("button", { name });

async function startNewProject(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: "New project" }));
  await user.click(button("Next"));
}

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

    await user.click(screen.getByRole("radio", { name: /Churn model/ }));
    expect(onChoose).not.toHaveBeenCalled();
    await user.click(button("Confirm"));

    expect(onChoose).toHaveBeenCalledWith({
      kind: "existing",
      projectId: "project-1",
    });
  });

  it("confirms nothing until something is picked", () => {
    openDialog();

    expect(button("Confirm")).toBeDisabled();
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
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
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

    expect(screen.getByRole("radio", { name: /Churn model/ })).toBeVisible();
    expect(screen.queryByRole("radio", { name: /Forecast/ })).toBeNull();
  });

  /** Confirming a project that is no longer on screen would be a surprise. */
  it("forgets a pick the search has hidden", async () => {
    const user = openDialog();

    await user.click(screen.getByRole("radio", { name: /Churn model/ }));
    await user.type(screen.getByLabelText("Search projects"), "forecast");

    expect(button("Confirm")).toBeDisabled();
  });

  it("names each project's workspace only when they are not all in one", () => {
    given({
      reachable: [
        project("project-1", "Churn model", "ws-1"),
        project("project-2", "Forecast", "ws-2"),
      ],
    });
    openDialog();

    expect(
      screen.getByRole("radio", { name: /Churn model/ }).closest("label"),
    ).toHaveTextContent("Research");
    expect(
      screen.getByRole("radio", { name: /Forecast/ }).closest("label"),
    ).toHaveTextContent("Analytics");
  });

  it("leaves the workspace off when every project shares one", () => {
    openDialog();

    expect(
      screen.getByRole("radio", { name: /Churn model/ }).closest("label"),
    ).not.toHaveTextContent("Research");
  });

  it("goes nowhere when cancelled", async () => {
    const user = openDialog();

    await user.click(button("Cancel"));

    expect(onDismiss).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  describe("a new project", () => {
    it("is a step of its own, reached by picking it", async () => {
      const user = openDialog();

      await startNewProject(user);

      expect(screen.queryByRole("radio")).toBeNull();
      expect(screen.getByLabelText("Name")).toHaveValue("Debug: Churn");
      expect(onChoose).not.toHaveBeenCalled();
    });

    it("is what is on offer when there are no projects to pick", async () => {
      given();
      const user = openDialog();

      expect(screen.getByRole("radio", { name: "New project" })).toBeChecked();
      await user.click(button("Next"));

      expect(screen.getByLabelText("Name")).toBeInTheDocument();
    });

    it("is named for what it is for unless renamed", async () => {
      const user = openDialog();

      await startNewProject(user);
      await user.click(button("Create and debug"));

      expect(onChoose).toHaveBeenCalledWith({
        kind: "new",
        workspaceId: "ws-1",
        name: "Debug: Churn",
      });
    });

    it("takes the name it is given", async () => {
      const user = openDialog();

      await startNewProject(user);
      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "  Why run-7 failed ");
      await user.click(button("Create and debug"));

      expect(onChoose).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Why run-7 failed" }),
      );
    });

    it("keeps the name typed when going back and forth", async () => {
      const user = openDialog();

      await startNewProject(user);
      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Why run-7 failed");
      await user.click(button("Back"));
      await user.click(button("Next"));

      expect(screen.getByLabelText("Name")).toHaveValue("Why run-7 failed");
    });

    it("cannot be made without a name", async () => {
      const user = openDialog();

      await startNewProject(user);
      await user.clear(screen.getByLabelText("Name"));

      expect(button("Create and debug")).toBeDisabled();
    });

    it("starts on the workspace last created in", async () => {
      rememberLastUsedWorkspace("ws-2");
      const user = openDialog();

      await startNewProject(user);
      await user.click(button("Create and debug"));

      expect(onChoose).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "ws-2" }),
      );
    });

    it("goes in the workspace that was picked", async () => {
      const user = openDialog();

      await startNewProject(user);
      await user.click(screen.getByLabelText("Workspace"));
      await user.click(screen.getByRole("option", { name: "Analytics" }));
      await user.click(button("Create and debug"));

      expect(onChoose).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "ws-2" }),
      );
    });

    it("cannot be made when no workspace takes new projects", async () => {
      given({ workspaces: [] });
      const user = openDialog();

      await startNewProject(user);

      expect(button("Create and debug")).toBeDisabled();
      expect(
        screen.getByText(/Projects cannot be created yet/),
      ).toBeInTheDocument();
    });
  });
});
