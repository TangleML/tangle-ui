import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pointerTo } from "@/services/localPipelines/localPipelinesService";
import { useAddResourceToProject } from "@/services/projects/useProjectResources";
import { useProjects } from "@/services/projects/useProjects";

import { AddToProjectDialog } from "./AddToProjectDialog";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();
const onAdded = vi.fn();
const onOpenChange = vi.fn();

vi.mock("@/services/projects/useProjectResources", () => ({
  useAddResourceToProject: vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProjects: vi.fn(),
}));

vi.mock("@/services/localPipelines/localPipelinesService", () => ({
  pointerTo: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

function mockProjects(items = [{ id: "project-1", name: "Churn work" }]) {
  vi.mocked(useProjects).mockReturnValue({
    data: { items },
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useProjects>);
}

const dialog = (memberProjectIds: string[] = []) =>
  render(
    <AddToProjectDialog
      pipelineName="Churn model"
      memberProjectIds={memberProjectIds}
      onOpenChange={onOpenChange}
      onAdded={onAdded}
    />,
  );

describe("AddToProjectDialog", () => {
  beforeEach(() => {
    mockProjects();
    vi.mocked(useAddResourceToProject).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useAddResourceToProject>);
    vi.mocked(pointerTo).mockResolvedValue({
      localName: "Churn model",
      localId: "file-1",
    });
  });
  afterEach(() => vi.resetAllMocks());

  it("files the pipeline under the project that was picked", async () => {
    dialog();

    await userEvent.click(screen.getByRole("button", { name: /Churn work/ }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toMatchObject({
      projectId: "project-1",
      input: { entity: "document", extraData: { type: "local_pipeline" } },
    });
  });

  /** Attribution follows membership, so the project just joined is where runs go. */
  it("sends the runs of this tab to the project it joined", async () => {
    dialog();

    await userEvent.click(screen.getByRole("button", { name: /Churn work/ }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    mutate.mock.calls[0][1].onSuccess();

    expect(onAdded).toHaveBeenCalledWith("project-1");
  });

  it("does not offer a project the pipeline is already in", () => {
    dialog(["project-1"]);

    expect(screen.getByRole("button", { name: /Churn work/ })).toBeDisabled();
    expect(screen.getByText("Added")).toBeInTheDocument();
  });

  it("narrows the list to what was searched for", async () => {
    mockProjects([
      { id: "project-1", name: "Churn work" },
      { id: "project-2", name: "Q3 models" },
    ]);
    dialog();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search projects" }),
      "q3",
    );

    expect(screen.getByRole("button", { name: /Q3 models/ })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Churn work/ }),
    ).not.toBeInTheDocument();
  });

  it("says so when there is no project to add it to", () => {
    mockProjects([]);

    dialog();

    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });
});
