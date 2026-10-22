import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useExecutionData } from "@/providers/ExecutionDataProvider";
import type { TeamResolution } from "@/services/teams/types";
import { useRunTeam } from "@/services/teams/useRunTeam";

import { useRunViewActions } from "./useRunViewActions";

vi.mock("@/providers/ComponentSpecProvider", () => ({
  useComponentSpec: () => ({ componentSpec: { name: "Churn" } }),
}));

vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionData: vi.fn(),
}));

vi.mock("@/hooks/useUserDetails", () => ({
  useUserDetails: () => ({ data: { id: "me@example.com" } }),
}));

vi.mock("@/hooks/useCheckComponentSpecFromPath", () => ({
  useCheckComponentSpecFromPath: () => false,
}));

vi.mock("@/services/teams/useRunTeam", () => ({
  useRunTeam: vi.fn(),
}));

const TEAM_ID = "ml-team@example.com";
const ACTIVE: TeamResolution = {
  status: "active",
  team: { id: TEAM_ID, label: "ML Research", canWrite: true },
};

function runCreatedBy(createdBy: string) {
  vi.mocked(useExecutionData).mockReturnValue({
    rootState: { child_execution_status_stats: {} },
    runId: "run-1",
    metadata: {
      id: "run-1",
      created_by: createdBy,
      execution_status_stats: { RUNNING: 1 },
    },
    rootDetails: undefined,
  } as unknown as ReturnType<typeof useExecutionData>);
}

describe("useRunViewActions", () => {
  beforeEach(() => {
    vi.mocked(useRunTeam).mockReturnValue(ACTIVE);
  });

  it("manages a run its team created as the team", () => {
    runCreatedBy(TEAM_ID);

    const { result } = renderHook(() => useRunViewActions());

    expect(useRunTeam).toHaveBeenCalledWith("run-1");
    expect(result.current).toMatchObject({
      ready: true,
      isInProgress: true,
      management: { canManage: true, teamId: TEAM_ID },
    });
  });

  it("manages your own run as you", () => {
    runCreatedBy("me@example.com");

    const { result } = renderHook(() => useRunViewActions());

    expect(result.current).toMatchObject({
      management: { canManage: true, teamId: undefined },
    });
  });
});
