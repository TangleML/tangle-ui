import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PipelineProgressCard } from "./PipelineProgressCard";

const openWorkareaTarget = vi.fn();
const recordSessionRun = vi.fn().mockResolvedValue(undefined);

const project = vi.hoisted(() => ({ activeSessionId: "session-1" }));

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
  useRunExecutionStats: (runId: string | undefined) => ({
    data: runId ? { SUCCEEDED: 3 } : undefined,
  }),
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
});
