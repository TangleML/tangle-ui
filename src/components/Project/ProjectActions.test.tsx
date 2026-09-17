import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/services/projects/types";
import { useDeleteProject } from "@/services/projects/useProjects";
import { copyToClipboard } from "@/utils/string";

import { ProjectActions } from "./ProjectActions";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();
const navigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("@/services/projects/useProjects", () => ({
  useDeleteProject: vi.fn(),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

vi.mock("@/utils/string", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("@/utils/URL", () => ({
  getProjectUrl: (id: string) => `https://tangle.example/projects/${id}`,
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
  resourceCounts: { pipeline: 1, document: 1 },
  notes: null,
};

function renderActions(overrides: Partial<Project> = {}) {
  return render(<ProjectActions project={{ ...project, ...overrides }} />);
}

async function openDeleteConfirmation(overrides: Partial<Project> = {}) {
  renderActions(overrides);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete project" }));

  return screen.findByRole("alertdialog");
}

describe("ProjectActions", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.mocked(useDeleteProject).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteProject>);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("copies the project's own url when sharing", async () => {
    renderActions();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Share project" }));

    expect(copyToClipboard).toHaveBeenCalledWith(
      "https://tangle.example/projects/project-1",
    );
    expect(notify).toHaveBeenCalledWith(
      "Project URL copied to clipboard",
      "success",
    );
  });

  it("opens the rename dialog on the project's current name", async () => {
    renderActions();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Rename project" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Rename");
  });

  it("warns what a delete will take with it", async () => {
    const dialog = await openDeleteConfirmation();

    expect(dialog).toHaveTextContent('Delete "Churn model"?');
    expect(dialog).toHaveTextContent(
      "This will also delete 1 pipeline · 1 document.",
    );
  });

  it("says so when there is nothing in the project to lose", async () => {
    const dialog = await openDeleteConfirmation({ resourceCounts: {} });

    expect(dialog).toHaveTextContent("This project is empty.");
  });

  it("returns to the list once the project is gone", async () => {
    await openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const [, options] = mutate.mock.calls[0];
    options.onSuccess({ id: "project-1", deletedResourceTotal: 2 });

    expect(notify).toHaveBeenCalledWith(
      "Project deleted along with 2 resources",
      "success",
    );
    expect(track).toHaveBeenCalledWith("projects.delete_project_completed", {
      deleted_resource_total: 2,
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/projects" });
  });

  it("stays put when the delete is dismissed", async () => {
    await openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(mutate).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
