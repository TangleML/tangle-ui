import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRunExecutionStats } from "@/services/projects/useProjectRuns";
import { getExecutionStatusLabel } from "@/utils/executionStatus";

import { ProjectRunStatus } from "./ProjectRunStatus";

vi.mock("@/services/projects/useProjectRuns", () => ({
  useRunExecutionStats: vi.fn(),
}));

vi.mock("@/components/shared/Status", () => ({
  StatusIcon: ({ status }: { status?: string }) => (
    <span data-testid="status-icon">{status ?? "none"}</span>
  ),
}));

function mockStats(overrides: Record<string, unknown> = {}) {
  vi.mocked(useRunExecutionStats).mockReturnValue({
    data: undefined,
    isPending: false,
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof useRunExecutionStats>);
}

const icon = () => screen.getByTestId("status-icon");

describe("ProjectRunStatus", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("asks for the run it was given", () => {
    mockStats({ isPending: true });
    render(<ProjectRunStatus runId="run-1" />);

    expect(useRunExecutionStats).toHaveBeenCalledWith("run-1");
  });

  it("boils a run's task counts down to one status", () => {
    mockStats({ data: { SUCCEEDED: 3, FAILED: 1 } });
    render(<ProjectRunStatus runId="run-1" />);

    expect(icon()).toHaveTextContent("FAILED");
  });

  it("calls a run of nothing but successes succeeded", () => {
    mockStats({ data: { SUCCEEDED: 4 } });
    render(<ProjectRunStatus runId="run-1" />);

    expect(icon()).toHaveTextContent("SUCCEEDED");
  });

  it("admits it does not know rather than implying success", () => {
    mockStats({ error: new Error("run is gone") });
    render(<ProjectRunStatus runId="run-1" />);

    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("admits it does not know when the run reports no task counts", () => {
    mockStats({ data: {} });
    render(<ProjectRunStatus runId="run-1" />);

    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("never shows a raw status constant where a label belongs", () => {
    mockStats({ data: {} });
    render(<ProjectRunStatus runId="run-1" />);

    expect(screen.queryByText("UNKNOWN")).toBeNull();
  });

  it("puts the status in words beside the icon", () => {
    mockStats({ data: { SUCCEEDED: 2 } });
    render(<ProjectRunStatus runId="run-1" />);

    expect(
      screen.getByText(getExecutionStatusLabel("SUCCEEDED")),
    ).toBeInTheDocument();
  });

  it("waits rather than guessing while the run is being fetched", () => {
    mockStats({ isPending: true });
    render(<ProjectRunStatus runId="run-1" />);

    expect(screen.queryByTestId("status-icon")).toBeNull();
  });
});
