import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Workspace } from "@/services/projects/types";
import { useCreateProject } from "@/services/projects/useProjects";

import { CreateProjectDialog } from "./CreateProjectDialog";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();

vi.mock("@/services/projects/useProjects", () => ({
  useCreateProject: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

const workspaces: Workspace[] = [
  {
    id: "workspace-1",
    name: "ML Research",
    description: null,
    isActive: true,
    extraData: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
  },
  {
    id: "workspace-2",
    name: "Growth",
    description: null,
    isActive: true,
    extraData: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
  },
];

function mockCreateProject({ isPending = false } = {}) {
  vi.mocked(useCreateProject).mockReturnValue({
    mutate,
    isPending,
  } as unknown as ReturnType<typeof useCreateProject>);
}

async function openDialog(
  available: Workspace[] = workspaces,
  canChooseWorkspace = true,
) {
  const user = userEvent.setup();
  render(
    <CreateProjectDialog
      workspaces={available}
      canChooseWorkspace={canChooseWorkspace}
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
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("records that the dialog was seen", async () => {
    await openDialog();

    expect(track).toHaveBeenCalledWith(
      "projects.create_project_dialog_impression",
    );
  });

  it("cannot be submitted without a name", async () => {
    await openDialog();

    expect(submitButton()).toBeDisabled();
  });

  it("never mentions the workspace when there is only one to use", async () => {
    const user = await openDialog([workspaces[0]]);

    await user.type(screen.getByLabelText("Name"), "Churn model");

    expect(screen.queryByLabelText("Workspace")).toBeNull();
    expect(screen.queryByText("ML Research")).toBeNull();
    expect(submitButton()).toBeEnabled();
  });

  it("hides the workspace choice from a non-admin who has several", async () => {
    const user = await openDialog(workspaces, false);

    await user.type(screen.getByLabelText("Name"), "Churn model");

    expect(screen.queryByLabelText("Workspace")).toBeNull();
    expect(submitButton()).toBeEnabled();
  });

  it("files a non-admin's project in the first workspace without asking", async () => {
    const user = await openDialog(workspaces, false);

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await user.click(submitButton());

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-1" }),
      expect.anything(),
    );
  });

  it("offers the choice to an admin with more than one workspace", async () => {
    const user = await openDialog(workspaces, true);

    await user.type(screen.getByLabelText("Name"), "Churn model");

    expect(screen.getByLabelText("Workspace")).toHaveTextContent("ML Research");
  });

  it("creates a project with a trimmed name and no description", async () => {
    const user = await openDialog([workspaces[0]]);

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

  it("creates a project with the chosen workspace and description", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");
    fireEvent.click(screen.getByLabelText("Workspace"));
    fireEvent.click(await screen.findByRole("option", { name: "Growth" }));
    await user.type(
      screen.getByLabelText("Description (optional)"),
      "Q3 churn work",
    );
    await user.click(submitButton());

    expect(mutate).toHaveBeenCalledWith(
      {
        workspaceId: "workspace-2",
        name: "Churn model",
        description: "Q3 churn work",
      },
      expect.anything(),
    );
  });

  it("confirms and closes once the project is created", async () => {
    const user = await openDialog([workspaces[0]]);

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await user.click(submitButton());

    const [, options] = mutate.mock.calls[0];
    options.onSuccess();

    expect(notify).toHaveBeenCalledWith("Project created", "success");
    expect(track).toHaveBeenCalledWith("projects.create_project_completed", {
      has_description: false,
    });
    await waitFor(() => {
      expect(screen.queryByLabelText("Name")).toBeNull();
    });
  });

  it("complains about an empty name only once the field has been visited", async () => {
    const user = await openDialog();

    expect(screen.queryByText("Name cannot be empty")).toBeNull();

    await user.click(screen.getByLabelText("Name"));
    await user.tab();

    expect(screen.getByText("Name cannot be empty")).toBeInTheDocument();
  });

  it("cannot be submitted twice while the first attempt is in flight", async () => {
    mockCreateProject({ isPending: true });

    const user = await openDialog([workspaces[0]]);
    await user.type(screen.getByLabelText("Name"), "Churn model");

    expect(submitButton()).toBeDisabled();
  });
});
