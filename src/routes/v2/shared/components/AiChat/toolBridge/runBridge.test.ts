import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentSpec } from "@/models/componentSpec";
import { serializeComponentSpec } from "@/models/componentSpec/serialization/serialize";
import { ProjectRunsQueryKeys } from "@/services/projects/types";
import { submitPipelineRun } from "@/utils/submitPipeline";

import { createRunBridgeHandlers } from "./runBridge";
import type { BridgeDeps } from "./utils";

vi.mock("@/utils/submitPipeline", () => ({ submitPipelineRun: vi.fn() }));

vi.mock("@/models/componentSpec/serialization/serialize", () => ({
  serializeComponentSpec: vi.fn(() => ({ name: "Churn" })),
}));

const PROJECT_ANNOTATION = "tangleml.com/project/id/project-9";

function deps(overrides: Partial<BridgeDeps> = {}): BridgeDeps {
  return {
    getSpec: () => ({ name: "Churn" }) as unknown as ComponentSpec,
    getActiveSubgraphPath: () => [],
    getActiveSubgraphTaskId: () => undefined,
    getBackendUrl: () => "http://backend",
    getRunAnnotations: () => ({ [PROJECT_ANNOTATION]: "true" }),
    ...overrides,
  };
}

function succeedsWithRun() {
  vi.mocked(submitPipelineRun).mockImplementation(
    async (_spec, _url, options) => {
      options?.onSuccess?.({ id: 7, root_execution_id: 42 } as never);
    },
  );
}

describe("runBridge submitPipelineRun", () => {
  beforeEach(() => succeedsWithRun());
  afterEach(() => vi.resetAllMocks());

  /**
   * A run says which project it belongs to through an annotation written when
   * it is created, so an agent submitting without one leaves a run that cannot
   * be attributed to the project it was asked for afterwards.
   */
  it("attributes the run to the project the editor is scoped to", async () => {
    await createRunBridgeHandlers(deps()).submitPipelineRun();

    expect(vi.mocked(submitPipelineRun).mock.calls[0][2]).toMatchObject({
      runAnnotations: { [PROJECT_ANNOTATION]: "true" },
    });
    expect(serializeComponentSpec).toHaveBeenCalled();
  });

  /** Everything reaching this bridge is an agent, not somebody clicking Run. */
  it("records the run as the agent's rather than the web app's", async () => {
    await createRunBridgeHandlers(deps()).submitPipelineRun();

    expect(vi.mocked(submitPipelineRun).mock.calls[0][2]).toMatchObject({
      runSource: "tangent-ui",
    });
  });

  it("refreshes the run feed of every project the run belongs to", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await createRunBridgeHandlers(deps({ queryClient })).submitPipelineRun();

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ProjectRunsQueryKeys.All("project-9"),
    });
  });

  it("refreshes nothing project-shaped when the run belongs to none", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await createRunBridgeHandlers(
      deps({ queryClient, getRunAnnotations: () => ({}) }),
    ).submitPipelineRun();

    for (const [{ queryKey }] of invalidate.mock.calls as [
      { queryKey: readonly unknown[] },
    ][]) {
      expect(queryKey[0]).not.toBe("projects");
    }
  });

  it("reports why the backend refused rather than a bare failure", async () => {
    vi.mocked(submitPipelineRun).mockImplementation(
      async (_spec, _url, options) => {
        options?.onError?.(new Error("spec is invalid"));
      },
    );

    const result = await createRunBridgeHandlers(deps()).submitPipelineRun();

    expect(result).toEqual({ success: false, error: "spec is invalid" });
  });

  describe("in a team's project", () => {
    const TEAM = { id: "ml-team@example.com", label: "ML Research" };

    it("submits the run as the team", async () => {
      const result = await createRunBridgeHandlers(
        deps({
          getRunTeam: () => ({
            status: "active",
            team: { ...TEAM, canWrite: true },
          }),
        }),
      ).submitPipelineRun();

      expect(vi.mocked(submitPipelineRun).mock.calls[0][2]).toMatchObject({
        teamId: TEAM.id,
      });
      expect(result).toMatchObject({ success: true, actingAsTeam: TEAM.id });
      expect(result.warning).toBeUndefined();
    });

    it("submits as the user and says why when they're not in the team", async () => {
      const result = await createRunBridgeHandlers(
        deps({ getRunTeam: () => ({ status: "not-member", team: TEAM }) }),
      ).submitPipelineRun();

      expect(vi.mocked(submitPipelineRun).mock.calls[0][2]).toMatchObject({
        teamId: undefined,
      });
      expect(result.success).toBe(true);
      expect(result.actingAsTeam).toBeUndefined();
      expect(result.warning).toMatch(
        /^Submitted as the user, not as the ML Research team, because they're not in that team\./,
      );
    });

    it("waits for the team before submitting", async () => {
      const result = await createRunBridgeHandlers(
        deps({ getRunTeam: () => ({ status: "resolving" }) }),
      ).submitPipelineRun();

      expect(submitPipelineRun).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error:
          "This project's team is still being checked. Try again in a moment.",
      });
    });

    it("refuses a run whose projects are on different teams", async () => {
      const result = await createRunBridgeHandlers(
        deps({
          getRunTeam: () => ({
            status: "conflict",
            teams: [TEAM, { id: "data@example.com", label: "Data" }],
          }),
        }),
      ).submitPipelineRun();

      expect(submitPipelineRun).not.toHaveBeenCalled();
      expect(result.error).toMatch(/different teams \(ML Research and Data\)/);
    });
  });
});
