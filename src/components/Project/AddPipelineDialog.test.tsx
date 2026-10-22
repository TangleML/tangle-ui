import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRemotePipelinesPage } from "@/hooks/useRemotePipelinesPage";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";

import { AddPipelineDialog } from "./AddPipelineDialog";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();
const backend = vi.hoisted(() => ({
  backendUrl: "https://backend.example",
  configured: true,
  available: true,
}));

vi.mock("@/hooks/useRemotePipelinesPage", () => ({
  useRemotePipelinesPage: vi.fn(),
}));
vi.mock("@/providers/BackendProvider", () => ({ useBackend: () => backend }));
vi.mock("@/services/projects/useProjectResources", () => ({
  useCreateProjectResource: vi.fn(),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

function mockPipelines(overrides: Record<string, unknown> = {}) {
  vi.mocked(useRemotePipelinesPage).mockReturnValue({
    data: {
      pipelines: [
        { id: "pipeline-1", pipeline_name: "Churn model" },
        { id: "pipeline-2", pipeline_name: "Fraud scoring" },
      ],
      nextPageToken: "page-2",
    },
    isPending: false,
    isFetching: false,
    isPlaceholderData: false,
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof useRemotePipelinesPage>);
}

function renderDialog(resources: ProjectResourceSummary[] = []) {
  const onOpenChange = vi.fn();
  const view = render(
    <AddPipelineDialog
      projectId="project-1"
      resources={resources}
      onOpenChange={onOpenChange}
    />,
  );
  return { ...view, onOpenChange, user: userEvent.setup() };
}

const pipeline = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}`) });

describe("AddPipelineDialog", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.mocked(useCreateProjectResource).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateProjectResource>);
    Object.assign(backend, {
      backendUrl: "https://backend.example",
      configured: true,
      available: true,
    });
    mockPipelines();
  });
  afterEach(() => vi.resetAllMocks());

  it("adds the saved pipeline by ID and closes after success", async () => {
    const { user, onOpenChange } = renderDialog();
    await user.click(pipeline("Churn model"));
    expect(mutate.mock.calls[0][0]).toEqual({
      entity: "pipeline",
      entityId: "pipeline-1",
      name: "Churn model",
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    await act(async () => mutate.mock.calls[0][1].onSuccess());
    expect(notify).toHaveBeenCalledWith("Pipeline added", "success");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("recognizes existing membership by ID even if the pipeline was renamed", () => {
    renderDialog([
      {
        entity: "pipeline",
        entityId: "pipeline-1",
        name: "Old name",
      } as ProjectResourceSummary,
    ]);
    expect(pipeline("Churn model")).toBeDisabled();
    expect(pipeline("Fraud scoring")).toBeEnabled();
  });

  it("does not mistake a document with the same name for the pipeline", () => {
    renderDialog([
      {
        entity: "document",
        entityId: null,
        name: "Churn model",
      } as ProjectResourceSummary,
    ]);
    expect(pipeline("Churn model")).toBeEnabled();
  });

  it("requests subsequent pages and resets pagination when the search changes", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(useRemotePipelinesPage).toHaveBeenLastCalledWith(
      backend.backendUrl,
      "page-2",
      true,
      undefined,
    );
    await user.type(screen.getByLabelText("Search pipelines"), "fraud");
    await waitFor(() =>
      expect(useRemotePipelinesPage).toHaveBeenLastCalledWith(
        backend.backendUrl,
        undefined,
        true,
        expect.stringContaining("fraud"),
      ),
    );
    expect(screen.getByText("Page 1")).toBeInTheDocument();
  });

  it("resets the cursor when the backend changes", async () => {
    const { user, rerender, onOpenChange } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Next" }));
    backend.backendUrl = "https://other.example";
    rerender(
      <AddPipelineDialog
        projectId="project-1"
        resources={[]}
        onOpenChange={onOpenChange}
      />,
    );
    expect(useRemotePipelinesPage).toHaveBeenLastCalledWith(
      backend.backendUrl,
      undefined,
      true,
      undefined,
    );
  });

  it("prevents adding a stale page while its replacement loads", () => {
    mockPipelines({ isPlaceholderData: true, isFetching: true });
    renderDialog();
    expect(pipeline("Churn model")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("keeps search available when no pipelines match", () => {
    mockPipelines({ data: { pipelines: [], nextPageToken: null } });
    renderDialog();
    expect(screen.getByText("No pipelines found")).toBeInTheDocument();
    expect(screen.getByLabelText("Search pipelines")).toBeVisible();
  });
});
