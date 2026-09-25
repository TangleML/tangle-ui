import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectRun } from "@/services/projects/types";
import {
  useProjectRuns,
  useRunExecutionStats,
} from "@/services/projects/useProjectRuns";

import { RunsWindowContent } from "./RunsWindowContent";

const openWorkareaTarget = vi.fn();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ projectId: "project-1", openWorkareaTarget }),
}));

vi.mock("@/services/projects/useProjectRuns", () => ({
  useProjectRuns: vi.fn(),
  useRunExecutionStats: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

function run(id: string, pipelineName: string | null): ProjectRun {
  return {
    id,
    rootExecutionId: `exec-${id}`,
    pipelineName,
    createdBy: null,
    createdAt: new Date("2026-09-22T10:00:00Z"),
  };
}

function given(...runs: ProjectRun[]) {
  vi.mocked(useProjectRuns).mockReturnValue({
    data: { items: runs, nextPageToken: null },
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useProjectRuns>);
}

describe("RunsWindowContent", () => {
  beforeEach(() => {
    given();
    vi.mocked(useRunExecutionStats).mockReturnValue({
      data: { SUCCEEDED: 15 },
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useRunExecutionStats>);
  });
  afterEach(() => vi.resetAllMocks());

  /**
   * A run reaches a project by an annotation written when it is created, not by
   * being added to it, so the feed is the only place an agent's run turns up.
   */
  it("lists the runs the project holds", () => {
    given(run("run-7", "Churn model"));

    render(<RunsWindowContent />);

    expect(screen.getByText("Churn model")).toBeInTheDocument();
    expect(useProjectRuns).toHaveBeenCalledWith("project-1");
  });

  it("opens one in the workarea", async () => {
    given(run("run-7", "Churn model"));
    const user = userEvent.setup();

    render(<RunsWindowContent />);
    await user.click(screen.getByTestId("open-run-run-7"));

    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "run", identity: "id/run-7" },
      "Churn model",
    );
  });

  it("still names a run whose pipeline has none", async () => {
    given(run("run-8", null));
    const user = userEvent.setup();

    render(<RunsWindowContent />);
    await user.click(screen.getByTestId("open-run-run-8"));

    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "run", identity: "id/run-8" },
      "Unnamed pipeline",
    );
  });

  it("says a project has been run nowhere rather than showing an empty list", () => {
    render(<RunsWindowContent />);

    expect(
      screen.getByText("Nothing in this project has been run yet"),
    ).toBeInTheDocument();
  });

  it("passes on why the feed could not be read", () => {
    vi.mocked(useProjectRuns).mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error("Backend is unreachable"),
    } as unknown as ReturnType<typeof useProjectRuns>);

    render(<RunsWindowContent />);

    expect(screen.getByText("Backend is unreachable")).toBeInTheDocument();
  });
});
