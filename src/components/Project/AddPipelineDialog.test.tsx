import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pointerTo } from "@/services/localPipelines/localPipelinesService";
import {
  useLocalPipelineNames,
  useResolvedPointers,
} from "@/services/localPipelines/useLocalPipelines";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";

import { AddPipelineDialog } from "./AddPipelineDialog";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();

vi.mock("@/services/projects/useProjectResources", () => ({
  useCreateProjectResource: vi.fn(),
}));

vi.mock("@/services/localPipelines/useLocalPipelines", () => ({
  useLocalPipelineNames: vi.fn(),
  useResolvedPointers: vi.fn(),
}));

vi.mock("@/services/localPipelines/localPipelinesService", () => ({
  pointerTo: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

function pointerResource(
  localName: string,
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: `resource-${localName}`,
    projectId: "project-1",
    entity: "document",
    name: localName,
    entityId: null,
    extraData: {
      type: "local_pipeline",
      storage: "browser",
      identity: `pipeline://name/${localName}`,
      fallbackName: localName,
    },
    createdBy: "alice@example.com",
    createdAt: new Date("2026-09-09T10:00:00Z"),
    updatedAt: new Date("2026-09-09T10:00:00Z"),
    ...overrides,
  };
}

function mockNames(
  value: Partial<ReturnType<typeof useLocalPipelineNames>> = {},
) {
  vi.mocked(useLocalPipelineNames).mockReturnValue({
    data: ["Churn model", "Fraud scoring"],
    isPending: false,
    error: null,
    ...value,
  } as unknown as ReturnType<typeof useLocalPipelineNames>);
}

function mockResolved(resolved: Record<string, string | null> = {}) {
  vi.mocked(useResolvedPointers).mockReturnValue({
    data: resolved,
  } as unknown as ReturnType<typeof useResolvedPointers>);
}

function renderDialog(resources: ProjectResourceSummary[] = []) {
  const onOpenChange = vi.fn();
  render(
    <AddPipelineDialog
      projectId="project-1"
      resources={resources}
      onOpenChange={onOpenChange}
    />,
  );
  return { onOpenChange, user: userEvent.setup() };
}

const pipeline = (name: string) =>
  screen.getByRole("button", {
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  });

describe("AddPipelineDialog", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.mocked(useCreateProjectResource).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateProjectResource>);
    vi.mocked(pointerTo).mockImplementation(async (name: string) => ({
      localName: name,
    }));
    mockNames();
    mockResolved();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("lists the pipelines this browser holds", () => {
    renderDialog();

    expect(pipeline("Churn model")).toBeInTheDocument();
    expect(pipeline("Fraud scoring")).toBeInTheDocument();
  });

  it("says plainly that a named pipeline cannot be shared", () => {
    renderDialog();

    expect(screen.getByRole("dialog")).toHaveTextContent(/cannot share it/);
  });

  it("narrows the list as the search is typed", async () => {
    const { user } = renderDialog();

    await user.type(screen.getByLabelText("Search pipelines"), "fraud");

    expect(pipeline("Fraud scoring")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Churn model" })).toBeNull();
  });

  it("says when nothing matches rather than showing an empty list", async () => {
    const { user } = renderDialog();

    await user.type(screen.getByLabelText("Search pipelines"), "zzz");

    expect(screen.getByText("No pipelines match that.")).toBeInTheDocument();
  });

  it("points somewhere useful when there are no pipelines at all", () => {
    mockNames({ data: [] });
    renderDialog();

    expect(
      screen.getByText("No pipelines in this browser"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Search pipelines")).toBeNull();
  });

  it("adds the pipeline that was picked, copying none of it", async () => {
    const { user } = renderDialog();

    await user.click(pipeline("Churn model"));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const [input] = mutate.mock.calls[0];
    expect(input).toMatchObject({
      entity: "document",
      name: "Churn model",
      payload: {},
      extraData: {
        type: "local_pipeline",
        storage: "browser",
        identity: "pipeline://name/Churn model",
        fallbackName: "Churn model",
      },
    });
  });

  it("records the pipeline's id when it has one", async () => {
    vi.mocked(pointerTo).mockResolvedValue({
      localName: "Churn model",
      localId: "id-9",
    });
    const { user } = renderDialog();

    await user.click(pipeline("Churn model"));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0].extraData).toMatchObject({
      identity: "pipeline://id/id-9",
      fallbackName: "Churn model",
    });
  });

  it("closes and says so once the pipeline is added", async () => {
    const { user, onOpenChange } = renderDialog();

    await user.click(pipeline("Churn model"));
    await waitFor(() => expect(mutate).toHaveBeenCalled());

    const [, options] = mutate.mock.calls[0];
    await act(async () => options.onSuccess());

    expect(track).toHaveBeenCalledWith("projects.add_pipeline_completed");
    expect(notify).toHaveBeenCalledWith("Pipeline added", "success");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("will not add a pipeline the project already names", () => {
    renderDialog([pointerResource("Churn model")]);

    expect(pipeline("Churn model")).toBeDisabled();
    expect(pipeline("Fraud scoring")).toBeEnabled();
  });

  /**
   * A pointer keeps the name the pipeline had when it was added, so the only
   * way to recognise a renamed one is by what its pointer resolves to now.
   */
  it("will not add a pipeline it already names under an older name", () => {
    mockResolved({ "Churn model (old)|": "Churn model" });
    renderDialog([pointerResource("Churn model (old)")]);

    expect(pipeline("Churn model")).toBeDisabled();
  });

  it("ignores documents that are not pipelines when working out what is added", () => {
    renderDialog([
      pointerResource("Churn model", { extraData: null, name: "Churn model" }),
    ]);

    expect(pipeline("Churn model")).toBeEnabled();
  });

  it("cannot be asked twice while it is saving", () => {
    vi.mocked(useCreateProjectResource).mockReturnValue({
      mutate,
      isPending: true,
    } as unknown as ReturnType<typeof useCreateProjectResource>);
    renderDialog();

    expect(pipeline("Churn model")).toBeDisabled();
  });

  it("explains a name too long to record instead of failing quietly", async () => {
    vi.mocked(pointerTo).mockResolvedValue({ localName: "p".repeat(2000) });
    mockNames({ data: ["p".repeat(2000)] });
    const { user } = renderDialog();

    await user.click(pipeline("p".repeat(2000)));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.stringContaining("too long"),
        "error",
      ),
    );
    expect(mutate).not.toHaveBeenCalled();
  });

  it("forgets a search that was cancelled", async () => {
    const { user, onOpenChange } = renderDialog();

    await user.type(screen.getByLabelText("Search pipelines"), "fraud");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
