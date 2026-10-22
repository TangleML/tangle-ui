import { getSnapshot } from "mobx-keystone";
import { describe, expect, it, vi } from "vitest";

import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { YamlDeserializer } from "@/models/componentSpec/serialization/yamlDeserializer";
import { PIPELINE_NOTES_ANNOTATION } from "@/utils/annotationKeys";
import { submitPipelineRun } from "@/utils/submitPipeline";

import { createReadOnlyToolBridge } from "./readOnlyToolBridge";

vi.mock("@/utils/submitPipeline", () => ({ submitPipelineRun: vi.fn() }));

function pipeline() {
  return new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
    name: "Inspection pipeline",
    implementation: {
      graph: {
        tasks: {
          Stage: {
            componentRef: {
              spec: {
                name: "Stage",
                implementation: {
                  graph: {
                    tasks: {
                      Worker: {
                        componentRef: {
                          spec: {
                            name: "Worker",
                            implementation: {
                              container: { image: "example/worker:1" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

describe("createReadOnlyToolBridge", () => {
  it("inspects the pipeline and active subgraph without changing the source", async () => {
    const spec = pipeline();
    const stage = spec.tasks[0];
    spec.annotations.set(PIPELINE_NOTES_ANNOTATION, "Root notes");
    stage.subgraphSpec?.annotations.set(
      PIPELINE_NOTES_ANNOTATION,
      "Stage notes",
    );
    const snapshot = getSnapshot(spec);
    const bridge = createReadOnlyToolBridge({
      getSpec: () => spec,
      getActiveSpec: () => stage.subgraphSpec ?? null,
      getActiveSubgraphPath: () => [stage.name],
      getActiveSubgraphTaskId: () => stage.$id,
    });

    expect(await bridge.getPipelineState()).toMatchObject({
      name: "Inspection pipeline",
      activeSubgraphPath: ["Stage"],
      activeSubgraphTaskId: stage.$id,
      notes: "Stage notes",
      tasks: [expect.objectContaining({ name: "Stage", isSubgraph: true })],
    });
    expect(await bridge.getSubgraphState(stage.$id)).toMatchObject({
      success: true,
      spec: { tasks: [expect.objectContaining({ name: "Worker" })] },
    });
    expect(await bridge.validatePipeline()).toMatchObject({
      valid: true,
      issueCount: 0,
    });
    expect(getSnapshot(spec)).toEqual(snapshot);
  });

  it("denies every write method even when called outside the worker tool list", async () => {
    const spec = pipeline();
    const snapshot = getSnapshot(spec);
    const bridge = createReadOnlyToolBridge({
      getSpec: () => spec,
      getActiveSubgraphPath: () => [],
      getActiveSubgraphTaskId: () => undefined,
      getBackendUrl: () => "https://backend.example.com",
    });
    const reads = new Set([
      "getPipelineState",
      "getSubgraphState",
      "validatePipeline",
      "searchComponents",
      "getRunDetails",
      "getExecutionDetails",
      "getExecutionState",
      "getContainerState",
      "getContainerLog",
      "debugPipelineRun",
    ]);

    for (const [name, handler] of Object.entries(bridge)) {
      if (reads.has(name)) continue;
      expect(await Reflect.apply(handler, bridge, []), name).toMatchObject({
        success: false,
        error: expect.stringContaining("read-only"),
      });
    }

    expect(getSnapshot(spec)).toEqual(snapshot);
    expect(submitPipelineRun).not.toHaveBeenCalled();
  });
});
