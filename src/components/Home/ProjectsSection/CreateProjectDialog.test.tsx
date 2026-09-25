import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

async function openDialog(workspaceId = "workspace-1") {
  const user = userEvent.setup();
  render(
    <CreateProjectDialog
      workspaceId={workspaceId}
      trigger={<button>New Project</button>}
    />,
  );
  await user.click(screen.getByRole("button", { name: /New Project/ }));
  return user;
}

const submitButton = () => screen.getByRole("button", { name: "Create" });

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

  it("never asks which workspace to use", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");

    expect(screen.queryByLabelText("Workspace")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(/workspace/i)).toBeNull();
    expect(submitButton()).toBeEnabled();
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

  it("files the project in whichever workspace it was handed", async () => {
    const user = await openDialog("workspace-from-backend");

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await user.type(
      screen.getByLabelText("Description (optional)"),
      "Q3 churn work",
    );
    await user.click(submitButton());

    expect(mutate).toHaveBeenCalledWith(
      {
        workspaceId: "workspace-from-backend",
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
