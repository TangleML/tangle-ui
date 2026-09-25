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

const PROJECT_ANNOTATION = "tangleml.com/project/project-id/project-9";

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
});
