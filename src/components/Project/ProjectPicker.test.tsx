import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineProjectMembership } from "@/services/projects/usePipelineProjects";
import { usePipelineProjects } from "@/services/projects/usePipelineProjects";
import { useDeleteProjectResource } from "@/services/projects/useProjectResources";

import { ProjectPicker } from "./ProjectPicker";
import { useRunProjectContext } from "./useRunProjectContext";

const setProjectId = vi.fn();
const removeResource = vi.fn();
const notify = vi.fn();
const track = vi.fn();

vi.mock("./useRunProjectContext", () => ({
  useRunProjectContext: vi.fn(),
}));

vi.mock("@/services/projects/usePipelineProjects", () => ({
  usePipelineProjects: vi.fn(),
}));

vi.mock("@/services/projects/useProjectResources", () => ({
  useDeleteProjectResource: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

vi.mock("./AddToProjectDialog", () => ({
  AddToProjectDialog: () => <div>add to project dialog</div>,
}));

function membership(id: string, name: string): PipelineProjectMembership {
  return {
    project: { id, name } as PipelineProjectMembership["project"],
    resource: {
      id: `resource-for-${id}`,
      name: "Churn model",
      entity: "document",
      entityId: null,
      extraData: { type: "local_pipeline" },
    } as unknown as PipelineProjectMembership["resource"],
  };
}

function given({
  enabled = true,
  projectId,
  projectName,
  memberships = [],
  isPending = false,
}: {
  enabled?: boolean;
  projectId?: string;
  projectName?: string;
  memberships?: PipelineProjectMembership[];
  isPending?: boolean;
} = {}) {
  vi.mocked(useRunProjectContext).mockReturnValue({
    enabled,
    projectId,
    projectName,
    projectIds: projectId ? [projectId] : [],
    setProjectId,
    dismiss: vi.fn(),
  });
  vi.mocked(usePipelineProjects).mockReturnValue({ memberships, isPending });
}

const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: /Project for/ }));
};

describe("ProjectPicker", () => {
  beforeEach(() => {
    given();
    vi.mocked(useDeleteProjectResource).mockReturnValue({
      mutate: removeResource,
    } as unknown as ReturnType<typeof useDeleteProjectResource>);
  });
  afterEach(() => vi.resetAllMocks());

  it("shows nothing at all while projects are switched off", () => {
    given({ enabled: false });

    const { container } = render(<ProjectPicker pipelineName="Churn model" />);

    expect(container).toBeEmptyDOMElement();
  });

  /** The old chip only appeared once a project was set, so there was nothing to click. */
  it("offers itself on a pipeline that belongs to no project", () => {
    render(<ProjectPicker pipelineName="Churn model" />);

    expect(
      screen.getByRole("button", { name: "Project for runs: No project" }),
    ).toBeInTheDocument();
  });

  it("names the project the runs of this tab go to", () => {
    given({ projectId: "project-1", projectName: "Churn work" });

    render(<ProjectPicker pipelineName="Churn model" />);

    expect(
      screen.getByRole("button", { name: "Project for runs: Churn work" }),
    ).toBeInTheDocument();
  });

  it("offers every project the pipeline is in", async () => {
    given({
      projectId: "project-1",
      projectName: "Churn work",
      memberships: [
        membership("project-1", "Churn work"),
        membership("project-2", "Q3 models"),
      ],
    });

    render(<ProjectPicker pipelineName="Churn model" />);
    await open();

    expect(
      screen.getByRole("menuitemradio", { name: "Q3 models" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Churn work" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("sends the runs of this tab somewhere else", async () => {
    given({
      projectId: "project-1",
      projectName: "Churn work",
      memberships: [
        membership("project-1", "Churn work"),
        membership("project-2", "Q3 models"),
      ],
    });

    render(<ProjectPicker pipelineName="Churn model" />);
    await open();
    await userEvent.click(
      screen.getByRole("menuitemradio", { name: "Q3 models" }),
    );

    expect(setProjectId).toHaveBeenCalledWith("project-2");
  });

  it("stops sending them anywhere", async () => {
    given({ projectId: "project-1", projectName: "Churn work" });

    render(<ProjectPicker pipelineName="Churn model" />);
    await open();
    await userEvent.click(
      screen.getByRole("menuitemradio", { name: "No project" }),
    );

    expect(setProjectId).toHaveBeenCalledWith(undefined);
  });

  /**
   * The id arrives in the URL and membership is never checked, so a project
   * that holds nothing can still be the one runs go to.
   */
  it("lists a chosen project the pipeline is not in", async () => {
    given({ projectId: "project-9", projectName: "Somebody else's" });

    render(<ProjectPicker pipelineName="Churn model" />);
    await open();

    expect(
      screen.getByRole("menuitemradio", { name: "Somebody else's" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("offers no removal from a project the pipeline is not in", async () => {
    given({ projectId: "project-9", projectName: "Somebody else's" });

    render(<ProjectPicker pipelineName="Churn model" />);
    await open();

    expect(screen.queryByText(/^Remove from/)).not.toBeInTheDocument();
  });

  it("takes the pipeline out of the project it is showing", async () => {
    given({
      projectId: "project-1",
      projectName: "Churn work",
      memberships: [membership("project-1", "Churn work")],
    });

    render(<ProjectPicker pipelineName="Churn model" />);
    await open();
    await userEvent.click(screen.getByText("Remove from Churn work"));
    await userEvent.click(
      await screen.findByRole("button", { name: "Continue" }),
    );

    await waitFor(() =>
      expect(removeResource).toHaveBeenCalledWith(
        "resource-for-project-1",
        expect.anything(),
      ),
    );
  });

  /** Removing it says the pipeline itself is safe, as the project page does. */
  it("says what removing it does before doing it", async () => {
    given({
      projectId: "project-1",
      projectName: "Churn work",
      memberships: [membership("project-1", "Churn work")],
    });

    render(<ProjectPicker pipelineName="Churn model" />);
    await open();
    await userEvent.click(screen.getByText("Remove from Churn work"));

    expect(
      await screen.findByText(/stays in the browser that holds it/),
    ).toBeInTheDocument();
    expect(removeResource).not.toHaveBeenCalled();
  });

  it("waits to be asked before reading every project's contents", () => {
    render(<ProjectPicker pipelineName="Churn model" />);

    expect(usePipelineProjects).toHaveBeenCalledWith("Churn model", {
      enabled: false,
    });
  });
});
