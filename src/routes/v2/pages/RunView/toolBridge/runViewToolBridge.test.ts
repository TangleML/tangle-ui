import { describe, expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { PIPELINE_NOTES_ANNOTATION } from "@/utils/annotationKeys";
import { submitPipelineRun } from "@/utils/submitPipeline";

import { createRunViewToolBridge } from "./runViewToolBridge";

vi.mock("@/utils/submitPipeline", () => ({ submitPipelineRun: vi.fn() }));

describe("createRunViewToolBridge", () => {
  it("reads the active graph's metadata and keeps its existing run handler", async () => {
    const root = new ComponentSpec({ name: "Root" });
    const active = new ComponentSpec({ name: "Stage" });
    root.annotations.set(PIPELINE_NOTES_ANNOTATION, "Root notes");
    active.annotations.set(PIPELINE_NOTES_ANNOTATION, "Stage notes");
    const bridge = createRunViewToolBridge({
      getSpec: () => root,
      getActiveSpec: () => active,
      getActiveSubgraphPath: () => ["Stage"],
      getActiveSubgraphTaskId: () => "stage-1",
      getBackendUrl: () => "https://backend.example.com",
    });
    vi.mocked(submitPipelineRun).mockImplementation(
      async (_spec, _url, options) => {
        options?.onError?.(new Error("Backend rejected the run"));
      },
    );

    expect(await bridge.getPipelineState()).toMatchObject({
      name: "Root",
      notes: "Stage notes",
      activeSubgraphPath: ["Stage"],
      activeSubgraphTaskId: "stage-1",
    });
    expect(await bridge.setPipelineName("Changed")).toMatchObject({
      success: false,
      error: expect.stringContaining("read-only"),
    });
    expect(root.name).toBe("Root");
    expect(await bridge.submitPipelineRun()).toEqual({
      success: false,
      error: "Backend rejected the run",
    });
    expect(submitPipelineRun).toHaveBeenCalledOnce();
  });
});
