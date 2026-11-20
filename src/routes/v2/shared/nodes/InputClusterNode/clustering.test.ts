import { describe, expect, it } from "vitest";

import { Binding } from "@/models/componentSpec/entities/binding";
import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Input } from "@/models/componentSpec/entities/input";

import { computeInputClusters, INPUT_CLUSTER_ID_PREFIX } from "./clustering";

function makeSpec(
  inputIds: string[],
  bindings: Array<{ source: string; target: string }>,
): ComponentSpec {
  return new ComponentSpec({
    $id: "spec_1",
    name: "Test",
    inputs: inputIds.map((id) => new Input({ $id: id, name: id })),
    bindings: bindings.map(
      ({ source, target }, index) =>
        new Binding({
          $id: `binding_${index}`,
          sourceEntityId: source,
          targetEntityId: target,
          sourcePortName: source,
          targetPortName: `port_${index}`,
        }),
    ),
  });
}

describe("computeInputClusters", () => {
  it("returns no clusters when there are no inputs", () => {
    expect(computeInputClusters(makeSpec([], []))).toEqual([]);
  });

  it("does not cluster inputs feeding different tasks", () => {
    const spec = makeSpec(
      ["input_a", "input_b"],
      [
        { source: "input_a", target: "task_1" },
        { source: "input_b", target: "task_2" },
      ],
    );

    expect(computeInputClusters(spec)).toEqual([]);
  });

  it("clusters inputs that share a consuming task", () => {
    const spec = makeSpec(
      ["input_a", "input_b"],
      [
        { source: "input_a", target: "task_1" },
        { source: "input_b", target: "task_1" },
      ],
    );

    const clusters = computeInputClusters(spec);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.id.startsWith(INPUT_CLUSTER_ID_PREFIX)).toBe(true);
    expect(clusters[0]?.inputEntityIds).toEqual(["input_a", "input_b"]);
  });

  it("merges clusters transitively across a bridging task", () => {
    // a+b share task_1; b+c share task_2 -> {a, b, c} is one component.
    const spec = makeSpec(
      ["input_a", "input_b", "input_c"],
      [
        { source: "input_a", target: "task_1" },
        { source: "input_b", target: "task_1" },
        { source: "input_b", target: "task_2" },
        { source: "input_c", target: "task_2" },
      ],
    );

    const clusters = computeInputClusters(spec);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.inputEntityIds).toEqual([
      "input_a",
      "input_b",
      "input_c",
    ]);
  });

  it("excludes singletons and unused inputs", () => {
    const spec = makeSpec(
      ["input_a", "input_b", "input_lonely", "input_unused"],
      [
        { source: "input_a", target: "task_1" },
        { source: "input_b", target: "task_1" },
        { source: "input_lonely", target: "task_2" },
      ],
    );

    const clusters = computeInputClusters(spec);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.inputEntityIds).toEqual(["input_a", "input_b"]);
  });

  it("produces separate clusters for disjoint groups", () => {
    const spec = makeSpec(
      ["input_a", "input_b", "input_c", "input_d"],
      [
        { source: "input_a", target: "task_1" },
        { source: "input_b", target: "task_1" },
        { source: "input_c", target: "task_2" },
        { source: "input_d", target: "task_2" },
      ],
    );

    const clusters = computeInputClusters(spec);
    expect(clusters).toHaveLength(2);
    const memberSets = clusters.map((c) => c.inputEntityIds);
    expect(memberSets).toContainEqual(["input_a", "input_b"]);
    expect(memberSets).toContainEqual(["input_c", "input_d"]);
  });

  it("is deterministic for the same membership", () => {
    const spec = makeSpec(
      ["input_a", "input_b"],
      [
        { source: "input_a", target: "task_1" },
        { source: "input_b", target: "task_1" },
      ],
    );

    const first = computeInputClusters(spec);
    const second = computeInputClusters(spec);
    expect(first[0]?.id).toBe(second[0]?.id);
  });
});
