import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchExecutionDetails } from "@/services/executionService";

import { PipelineProgressCard } from "./PipelineProgressCard";

const openWorkareaTarget = vi.fn();
const recordSessionRun = vi.fn().mockResolvedValue(undefined);

const project = vi.hoisted(() => ({ activeSessionId: "session-1" }));
const statsQuery = vi.hoisted(() => ({
  override: undefined as { data?: null; isLoading: boolean } | undefined,
}));

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ ...project, openWorkareaTarget }),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useSessionRuns", () => ({
  useRecordSessionRun: () => recordSessionRun,
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://tangle.example" }),
}));

vi.mock("@/services/executionService", () => ({
  fetchExecutionDetails: vi.fn().mockResolvedValue({
    pipeline_run_id: "run-7",
    task_spec: { componentRef: { spec: { name: "Friendly Hello Generator" } } },
  }),
}));

vi.mock("@/services/projects/useProjectRuns", () => ({
  useRunExecutionStats: (runId: string | undefined) =>
    statsQuery.override ?? { data: runId ? { SUCCEEDED: 3 } : undefined },
}));

function renderCard(props: Record<string, unknown>) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <PipelineProgressCard
      name="pipeline-progress"
      kind="message"
      props={props}
    />,
    { wrapper },
  );
}

describe("PipelineProgressCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    project.activeSessionId = "session-1";
    statsQuery.override = undefined;
  });

  it("keeps its run with the chat it was drawn in when another chat opens", async () => {
    const { rerender } = renderCard({ runId: "run-7", title: "Train" });
    await waitFor(() => expect(recordSessionRun).toHaveBeenCalledTimes(1));

    project.activeSessionId = "session-2";
    rerender(
      <PipelineProgressCard
        name="pipeline-progress"
        kind="message"
        props={{ runId: "run-7", title: "Train" }}
      />,
    );

    expect(recordSessionRun).toHaveBeenCalledTimes(1);
    expect(recordSessionRun).toHaveBeenCalledWith(
      "session-1",
      "run-7",
      "Train",
    );
  });

  it("finds the run behind an execution and shows how far it got", async () => {
    renderCard({ executionId: "exec-1" });

    expect(
      await screen.findByText("Friendly Hello Generator"),
    ).toBeInTheDocument();
    expect(screen.getByText("Succeeded — 3/3 tasks")).toBeInTheDocument();
  });

  it("opens the run beside the chat instead of asking the agent to", async () => {
    const user = userEvent.setup();
    renderCard({ executionId: "exec-1" });

    await user.click(await screen.findByRole("button", { name: /Friendly/ }));

    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "run", identity: "id/run-7" },
      "Friendly Hello Generator",
    );
  });

  it("adds the run to the chat's runs once", async () => {
    const { rerender } = renderCard({ runId: "run-9", title: "Nightly" });

    await waitFor(() =>
      expect(recordSessionRun).toHaveBeenCalledWith(
        "session-1",
        "run-9",
        "Nightly",
      ),
    );
    rerender(
      <PipelineProgressCard
        name="pipeline-progress"
        kind="message"
        props={{ runId: "run-9", title: "Nightly" }}
      />,
    );
    expect(recordSessionRun).toHaveBeenCalledTimes(1);
  });

  it.each([
    { executionId: "../../pipeline_runs/7/cancel" },
    { runId: "run-7/../../users/me" },
    { executionId: "exec 1", runId: "run-7?x=1" },
  ])(
    "neither looks up nor records ids that could not be real: %o",
    async (ids) => {
      renderCard({ ...ids, title: "Train" });

      expect(await screen.findByText("Status unavailable")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Train/ })).toBeDisabled();
      expect(fetchExecutionDetails).not.toHaveBeenCalled();
      expect(recordSessionRun).not.toHaveBeenCalled();
    },
  );

  it("falls back to the execution when the run id it was given is malformed", async () => {
    renderCard({ executionId: "exec-1", runId: "run 7", title: "Train" });

    await waitFor(() =>
      expect(recordSessionRun).toHaveBeenCalledWith(
        "session-1",
        "run-7",
        "Train",
      ),
    );
    expect(fetchExecutionDetails).toHaveBeenCalledWith(
      "exec-1",
      "https://tangle.example",
    );
  });

  it.each([
    ["while the status is on its way", { isLoading: true }],
    ["for a run that hasn't started", { data: null, isLoading: false }],
  ])("says it's loading %s", (_when, query) => {
    statsQuery.override = query;

    renderCard({ runId: "run-7", title: "Train" });

    expect(screen.getByText("Loading status…")).toBeInTheDocument();
  });

  it("stops saying it's loading for a run whose status can't be read, such as a deleted one", () => {
    statsQuery.override = { isLoading: false };

    renderCard({ runId: "run-7", title: "Train" });

    expect(screen.getByText("Status unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Loading status…")).not.toBeInTheDocument();
  });

  it("stops saying it's loading when the execution it was given turns out to have no run", async () => {
    vi.mocked(fetchExecutionDetails).mockResolvedValueOnce({
      id: "exec-1",
      pipeline_run_id: null,
      task_spec: { componentRef: {} },
      child_task_execution_ids: {},
    });

    renderCard({ executionId: "exec-1", title: "Train" });

    expect(screen.getByText("Loading status…")).toBeInTheDocument();
    expect(await screen.findByText("Status unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Train/ })).toBeDisabled();
  });
});
