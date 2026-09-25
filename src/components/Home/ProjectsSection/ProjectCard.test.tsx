import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFlagValue } from "@/components/shared/Settings/useFlags";
import type { ProjectSummary } from "@/services/projects/types";
import { useDeleteProject } from "@/services/projects/useProjects";
import { copyToClipboard } from "@/utils/string";

import { ProjectCard } from "./ProjectCard";
import { useProjectPin } from "./useProjectPin";

const mutate = vi.fn();
const togglePin = vi.fn();
const notify = vi.fn();
const track = vi.fn();
const navigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params: { projectId: string };
  }) => <a href={to.replace("$projectId", params.projectId)}>{children}</a>,
  useNavigate: () => navigate,
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

vi.mock("./useProjectPin", () => ({ useProjectPin: vi.fn() }));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: vi.fn(),
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

function mockPin({ pinned = false } = {}) {
  vi.mocked(useProjectPin).mockReturnValue({ pinned, togglePin });
}

function mockFlags(flags: Record<string, boolean>) {
  vi.mocked(useFlagValue).mockImplementation((flag) => flags[flag] ?? false);
}

function renderCard(overrides: Partial<ProjectSummary> = {}) {
  return render(<ProjectCard project={{ ...project, ...overrides }} />);
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
    mockDeleteProject();
    mockPin();
    mockFlags({ "tangent-shell": true });
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

  /**
   * A tile sits in a fixed-width grid track, and its stacks lay children out
   * at their content width unless told otherwise — so without these a long
   * name or a long list of counts runs out over the tile beside it. jsdom
   * computes no layout, so the classes that do the containing are what can be
   * pinned here; the rendering itself was checked in a browser.
   */
  it("keeps a name too long for the tile inside it", () => {
    renderCard({ name: "Supercalifragilisticexpialidocious_Churn_Model_V4" });

    const name = screen.getByText(
      "Supercalifragilisticexpialidocious_Churn_Model_V4",
    );
    expect(name).toHaveClass("truncate");
    expect(name).toHaveClass("min-w-0");
  });

  it("wraps a description that is one unbroken word", () => {
    renderCard({ description: "Averyverylongsinglewordwithoutanyspacesatall" });

    expect(
      screen.getByText("Averyverylongsinglewordwithoutanyspacesatall"),
    ).toHaveClass("wrap-break-word");
  });

  it("keeps a long list of counts inside the tile", () => {
    renderCard({
      resourceCounts: { pipeline: 12, document: 34, run: 56, notebook: 7 },
    });

    expect(screen.getByText(/12 pipelines/)).toHaveClass("truncate");
  });

  it("opens the project where the work happens, not its details", () => {
    renderCard();

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/tangent/project-1",
    );
  });

  it("still reaches the details page from the menu", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(
      screen.getByRole("button", { name: "Project actions: Churn model" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Details/ }));

    expect(navigate).toHaveBeenCalledWith({
      to: "/projects/$projectId",
      params: { projectId: "project-1" },
    });
  });

  /**
   * Tangent is what turns a project into somewhere to work. Without it the
   * project's own page is the only page, so the card goes straight there and
   * the menu stops offering a second way to the same place.
   */
  describe("without Tangent", () => {
    beforeEach(() => {
      mockFlags({ "tangent-shell": false });
    });

    it("opens the project's own page", () => {
      renderCard();

      expect(screen.getByRole("link")).toHaveAttribute(
        "href",
        "/projects/project-1",
      );
    });

    it("drops the details item, which now goes where the card goes", async () => {
      const user = userEvent.setup();
      renderCard();

      await user.click(
        screen.getByRole("button", { name: "Project actions: Churn model" }),
      );

      expect(screen.queryByRole("menuitem", { name: /Details/ })).toBeNull();
    });

    it("does not count sessions the user cannot see", () => {
      renderCard({
        resourceCounts: { pipeline: 3, agent_session: 2, document: 1 },
      });

      expect(screen.getByText("3 pipelines · 1 document")).toBeInTheDocument();
    });
  });

  it("counts sessions among a project's contents when Tangent is on", () => {
    renderCard({
      resourceCounts: { pipeline: 3, agent_session: 2, document: 1 },
    });

    expect(
      screen.getByText("3 pipelines · 2 agent sessions · 1 document"),
    ).toBeInTheDocument();
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

  /** A pinned project leads the grid, and has to say why it is out in front. */
  it("marks a pinned project on the card itself", () => {
    mockPin({ pinned: true });
    renderCard();

    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
  });

  it("leaves an unpinned project unmarked", () => {
    renderCard();

    expect(screen.queryByLabelText("Pinned")).toBeNull();
  });

  it("pins the project from its own menu", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(
      screen.getByRole("button", { name: "Project actions: Churn model" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Pin/ }));

    expect(togglePin).toHaveBeenCalled();
  });

  it("says nothing about the workspace a project lives in", () => {
    renderCard();

    expect(screen.queryByText("ML Research")).toBeNull();
    expect(screen.queryByText("workspace-1")).toBeNull();
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
