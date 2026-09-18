import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    window.localStorage.clear();
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
    options.onSuccess({ id: "project-1" });

    expect(notify).toHaveBeenCalledWith("Project created", "success");
    expect(track).toHaveBeenCalledWith(
      "projects.create_project_completed",
      expect.objectContaining({ has_description: false }),
    );
    await waitFor(() => {
      expect(screen.queryByLabelText("Name")).toBeNull();
    });
  });

  it("colours the project it just created", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await user.click(screen.getByRole("button", { name: "Emerald" }));
    await user.click(submitButton());

    const [, options] = mutate.mock.calls[0];
    options.onSuccess({ id: "project-1" });

    expect(
      JSON.parse(window.localStorage.getItem("projectColors") ?? "{}"),
    ).toEqual({ "project-1": "emerald" });
    expect(track).toHaveBeenCalledWith(
      "projects.create_project_completed",
      expect.objectContaining({ color: "emerald" }),
    );
  });

  it("leaves a project uncoloured when no colour was picked", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("Name"), "Churn model");
    await user.click(submitButton());

    const [, options] = mutate.mock.calls[0];
    options.onSuccess({ id: "project-1" });

    expect(
      JSON.parse(window.localStorage.getItem("projectColors") ?? "{}"),
    ).toEqual({});
    expect(track).toHaveBeenCalledWith(
      "projects.create_project_completed",
      expect.objectContaining({ color: "none" }),
    );
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

    const user = await openDialog();
    await user.type(screen.getByLabelText("Name"), "Churn model");

    expect(submitButton()).toBeDisabled();
  });
});
