import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectSummary } from "@/services/projects/types";
import { useDeleteProject } from "@/services/projects/useProjects";
import { copyToClipboard } from "@/utils/string";

import { ProjectCard } from "./ProjectCard";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/services/projects/useProjects", () => ({
  useDeleteProject: vi.fn(),
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

const project: ProjectSummary = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Churn model",
  description: "Q3 churn work",
  createdBy: "someone@example.com",
  origin: "user",
  createdAt: new Date("2026-09-02T10:00:00Z"),
  updatedAt: new Date("2026-09-15T10:00:00Z"),
  resourceCounts: { pipeline: 3, document: 1 },
};

function mockDeleteProject({ isPending = false } = {}) {
  vi.mocked(useDeleteProject).mockReturnValue({
    mutate,
    isPending,
  } as unknown as ReturnType<typeof useDeleteProject>);
}

function renderCard(overrides: Partial<ProjectSummary> = {}) {
  return render(<ProjectCard project={{ ...project, ...overrides }} />);
}

async function openColorPicker() {
  const user = userEvent.setup();
  renderCard();

  await user.click(
    screen.getByRole("button", { name: "Project actions: Churn model" }),
  );
  await user.click(await screen.findByRole("menuitem", { name: /Colour/ }));
  await screen.findByRole("button", { name: "Cyan" });
}

// Radix's submenu swallows userEvent's pointer sequence in jsdom, so the swatch
// never sees the click; a bare click event still reaches it.
function pickColor(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

async function openDeleteConfirmation(overrides: Partial<ProjectSummary> = {}) {
  const user = userEvent.setup();
  renderCard(overrides);

  await user.click(
    screen.getByRole("button", { name: "Project actions: Churn model" }),
  );
  await user.click(await screen.findByRole("menuitem", { name: /Delete/ }));

  return screen.findByRole("alertdialog");
}

describe("ProjectCard", () => {
  beforeEach(() => {
    // jsdom implements neither, and Radix's menu calls both while opening.
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    window.localStorage.clear();
    mockDeleteProject();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("shows the project's name, description and contents", () => {
    renderCard();

    expect(screen.getByText("Churn model")).toBeInTheDocument();
    expect(screen.getByText("Q3 churn work")).toBeInTheDocument();
    expect(screen.getByText("3 pipelines · 1 document")).toBeInTheDocument();
  });

  it("copies the project's own url when sharing", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(
      screen.getByRole("button", { name: "Project actions: Churn model" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Share/ }));

    expect(copyToClipboard).toHaveBeenCalledWith(
      "https://tangle.example/projects/project-1",
    );
    expect(notify).toHaveBeenCalledWith(
      "Project URL copied to clipboard",
      "success",
    );
  });

  it("does not delete anything when sharing", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(
      screen.getByRole("button", { name: "Project actions: Churn model" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Share/ }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("says nothing about the workspace a project lives in", () => {
    renderCard();

    expect(screen.queryByText("ML Research")).toBeNull();
    expect(screen.queryByText("workspace-1")).toBeNull();
  });

  it("starts a project off with no colour", async () => {
    await openColorPicker();

    expect(screen.getByRole("button", { name: "No colour" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("remembers the colour a user gives the card", async () => {
    await openColorPicker();

    pickColor("Cyan");

    expect(track).toHaveBeenCalledWith("projects.set_project_color", {
      color: "cyan",
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cyan" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  it("offers a stored colour back as the card's current one", async () => {
    window.localStorage.setItem(
      "projectColors",
      JSON.stringify({ "project-1": "rose" }),
    );

    await openColorPicker();

    expect(screen.getByRole("button", { name: "Rose" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("lets a user take a colour back off the card", async () => {
    window.localStorage.setItem(
      "projectColors",
      JSON.stringify({ "project-1": "rose" }),
    );
    await openColorPicker();

    pickColor("No colour");

    expect(track).toHaveBeenCalledWith("projects.set_project_color", {
      color: "none",
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "No colour" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  it("keeps one project's colour off another project's card", async () => {
    window.localStorage.setItem(
      "projectColors",
      JSON.stringify({ "project-2": "rose" }),
    );

    await openColorPicker();

    expect(screen.getByRole("button", { name: "No colour" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("warns what a delete will take with it", async () => {
    const dialog = await openDeleteConfirmation();

    expect(dialog).toHaveTextContent('Delete "Churn model"?');
    expect(dialog).toHaveTextContent(
      "This will also delete 3 pipelines · 1 document.",
    );
  });

  it("says so when there is nothing in the project to lose", async () => {
    const dialog = await openDeleteConfirmation({ resourceCounts: {} });

    expect(dialog).toHaveTextContent("This project is empty.");
  });

  it("deletes the project once the warning is accepted", async () => {
    await openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith("project-1", expect.anything());
    });
  });

  it("keeps the project when the warning is dismissed", async () => {
    await openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("reports how much the delete removed", async () => {
    await openDeleteConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const [, options] = mutate.mock.calls[0];
    options.onSuccess({ id: "project-1", deletedResourceTotal: 4 });

    expect(notify).toHaveBeenCalledWith(
      "Project deleted along with 4 resources",
      "success",
    );
    expect(track).toHaveBeenCalledWith("projects.delete_project_completed", {
      deleted_resource_total: 4,
    });
  });

  it("does not mention resources when an empty project is deleted", async () => {
    await openDeleteConfirmation({ resourceCounts: {} });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const [, options] = mutate.mock.calls[0];
    options.onSuccess({ id: "project-1", deletedResourceTotal: 0 });

    expect(notify).toHaveBeenCalledWith("Project deleted", "success");
  });
});
