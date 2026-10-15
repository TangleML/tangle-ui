import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rememberLastUsedWorkspace } from "@/services/projects/defaultWorkspace";
import type { Workspace } from "@/services/projects/types";
import { useCreateProject } from "@/services/projects/useProjects";

import { CreateProjectDialog } from "./CreateProjectDialog";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();
const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/services/projects/useProjects", () => ({
  useCreateProject: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

function enableFlags(flags: Record<string, boolean>) {
  localStorage.setItem("betaFlags", JSON.stringify(flags));
}

function mockCreateProject({ isPending = false } = {}) {
  vi.mocked(useCreateProject).mockReturnValue({
    mutate,
    isPending,
  } as unknown as ReturnType<typeof useCreateProject>);
}

const workspace = (
  id: string,
  name: string,
  createdAt: string,
  overrides: Partial<Workspace> = {},
): Workspace => ({
  id,
  name,
  description: null,
  isActive: true,
  metadata: null,
  createdAt: new Date(createdAt),
  ...overrides,
});

const research = workspace("workspace-1", "Research", "2026-01-01T00:00:00Z");
const analytics = workspace("workspace-2", "Analytics", "2026-06-01T00:00:00Z");

async function openDialog(workspaces: Workspace[] = [analytics, research]) {
  const user = userEvent.setup();
  render(
    <CreateProjectDialog
      workspaces={workspaces}
      trigger={<button>New Project</button>}
    />,
  );
  await user.click(screen.getByRole("button", { name: /New Project/ }));
  return user;
}

const submitButton = () => screen.getByRole("button", { name: "Create" });

async function pickWorkspace(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByLabelText("Workspace"));
  await user.click(screen.getByRole("option", { name }));
}

describe("CreateProjectDialog", () => {
  beforeEach(() => {
    // jsdom implements neither, and Radix's select calls both while opening.
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    mockCreateProject();
    enableFlags({ projects: true, "tangent-shell": true });
  });

  afterEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("records that the dialog was seen", async () => {
    await openDialog();

    expect(track).toHaveBeenCalledWith(
      "projects.create_project_dialog_impression",
    );
  });

  it("makes nothing out of an empty name", async () => {
    const user = await openDialog();

    await user.click(submitButton());

    expect(mutate).not.toHaveBeenCalled();
  });

  /** Users who never touch the picker keep getting the workspace they always had. */
  it("starts on the oldest workspace rather than the first listed", async () => {
    await openDialog();

    expect(screen.getByLabelText("Workspace")).toHaveTextContent("Research");
  });

  it("starts on the workspace last created in", async () => {
    rememberLastUsedWorkspace("workspace-2");

    await openDialog();

    expect(screen.getByLabelText("Workspace")).toHaveTextContent("Analytics");
  });

  it("asks for a workspace even when there is only one", async () => {
    await openDialog([research]);

    expect(screen.getByLabelText("Workspace")).toHaveTextContent("Research");
  });

  it("warns that the workspace is permanent", async () => {
    await openDialog();

    expect(screen.getByLabelText("Workspace")).toHaveAccessibleDescription(
      "The workspace cannot be changed after the project is created.",
    );
  });

  it("files the project in the workspace that was picked", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await pickWorkspace(user, "Analytics");
    await user.click(submitButton());

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-2" }),
      expect.anything(),
    );
  });

  it("remembers the workspace for the next project", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await pickWorkspace(user, "Analytics");
    await user.click(submitButton());

    const [, options] = mutate.mock.calls[0];
    options.onSuccess({ id: "project-9" });

    expect(localStorage.getItem("tangle.projects.lastUsedWorkspaceId")).toBe(
      JSON.stringify("workspace-2"),
    );
  });

  it("forgets a pick that was cancelled", async () => {
    const user = await openDialog();

    await pickWorkspace(user, "Analytics");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: /New Project/ }));

    expect(screen.getByLabelText("Workspace")).toHaveTextContent("Research");
    expect(
      localStorage.getItem("tangle.projects.lastUsedWorkspaceId"),
    ).toBeNull();
  });

  it("records whether the preselected workspace was changed", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await pickWorkspace(user, "Analytics");
    await user.click(submitButton());

    const [, options] = mutate.mock.calls[0];
    options.onSuccess({ id: "project-9" });

    expect(track).toHaveBeenCalledWith("projects.create_project_completed", {
      has_description: false,
      workspace_changed: true,
    });
  });

  it("creates a project with a trimmed name and no description", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "  Churn model  ");
    await user.click(submitButton());

    expect(mutate).toHaveBeenCalledWith(
      {
        workspaceId: "workspace-1",
        name: "Churn model",
        description: undefined,
      },
      expect.anything(),
    );
  });

  it("creates a project with its description", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await user.type(
      screen.getByLabelText("Description (optional)"),
      "Q3 churn work",
    );
    await user.click(submitButton());

    expect(mutate).toHaveBeenCalledWith(
      {
        workspaceId: "workspace-1",
        name: "Churn model",
        description: "Q3 churn work",
      },
      expect.anything(),
    );
  });

  it("confirms and closes once the project is created", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await user.click(submitButton());

    const [, options] = mutate.mock.calls[0];
    options.onSuccess({ id: "project-9" });

    expect(notify).toHaveBeenCalledWith("Project created", "success");
    expect(track).toHaveBeenCalledWith("projects.create_project_completed", {
      has_description: false,
      workspace_changed: false,
    });
    await waitFor(() => {
      expect(screen.queryByLabelText("Name")).toBeNull();
    });
  });

  it("opens the project it just created", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await user.click(submitButton());

    const [, options] = mutate.mock.calls[0];
    options.onSuccess({ id: "project-9" });

    expect(navigate).toHaveBeenCalledWith({
      to: "/tangent/$projectId",
      params: { projectId: "project-9" },
    });
  });

  it("opens the project's own page when Tangent is off", async () => {
    enableFlags({ projects: true, "tangent-shell": false });
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await user.click(submitButton());

    const [, options] = mutate.mock.calls[0];
    options.onSuccess({ id: "project-9" });

    expect(navigate).toHaveBeenCalledWith({
      to: "/projects/$projectId",
      params: { projectId: "project-9" },
    });
  });

  it("goes nowhere while the project is still being created", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await user.click(submitButton());

    expect(navigate).not.toHaveBeenCalled();
  });

  /**
   * The complaint used to appear on blur, which grew the dialog underneath a
   * pointer already on its way to Cancel and swallowed the click. Leaving the
   * field has to say nothing at all.
   */
  it("says nothing when an empty name is merely left", async () => {
    const user = await openDialog();

    await user.click(screen.getByLabelText("Name"));
    await user.tab();

    expect(screen.queryByText("Name cannot be empty")).toBeNull();
  });

  it("complains about an empty name once Create is pressed", async () => {
    const user = await openDialog();

    expect(screen.queryByText("Name cannot be empty")).toBeNull();

    await user.click(submitButton());

    expect(screen.getByText("Name cannot be empty")).toBeInTheDocument();
  });

  it("can be cancelled after visiting the name field", async () => {
    const user = await openDialog();

    await user.click(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("cannot be submitted twice while the first attempt is in flight", async () => {
    mockCreateProject({ isPending: true });

    const user = await openDialog();
    await user.type(screen.getByLabelText("Name"), "Churn model");

    expect(submitButton()).toBeDisabled();
  });
});
