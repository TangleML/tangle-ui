import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { Binding } from "@/models/componentSpec/entities/binding";
import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Input } from "@/models/componentSpec/entities/input";
import { INPUT_CLUSTERS_ANNOTATION } from "@/utils/annotations";

import { applyInputClustering } from "./applyInputClustering";

function makeSpec(): ComponentSpec {
  return new ComponentSpec({
    $id: "spec_1",
    name: "Test",
    inputs: [
      new Input({ $id: "input_a", name: "alpha" }),
      new Input({ $id: "input_b", name: "beta" }),
      new Input({ $id: "input_c", name: "gamma" }),
    ],
    bindings: [
      // a + b feed task_1 -> clustered together; c feeds task_2 alone.
      new Binding({
        $id: "binding_0",
        sourceEntityId: "input_a",
        targetEntityId: "task_1",
        sourcePortName: "input_a",
        targetPortName: "in_a",
      }),
      new Binding({
        $id: "binding_1",
        sourceEntityId: "input_b",
        targetEntityId: "task_1",
        sourcePortName: "input_b",
        targetPortName: "in_b",
      }),
      new Binding({
        $id: "binding_2",
        sourceEntityId: "input_c",
        targetEntityId: "task_2",
        sourcePortName: "input_c",
        targetPortName: "in_c",
      }),
    ],
  });
}

function makeNodes(): Node[] {
  return [
    { id: "input_a", type: "input", position: { x: 0, y: 0 }, data: {} },
    { id: "input_b", type: "input", position: { x: 0, y: 100 }, data: {} },
    { id: "input_c", type: "input", position: { x: 0, y: 200 }, data: {} },
    { id: "task_1", type: "task", position: { x: 300, y: 0 }, data: {} },
    { id: "task_2", type: "task", position: { x: 300, y: 200 }, data: {} },
  ];
}

function makeEdges(): Edge[] {
  return [
    {
      id: "edge_binding_0",
      source: "input_a",
      sourceHandle: "output_input_a",
      target: "task_1",
      targetHandle: "input_in_a",
    },
    {
      id: "edge_binding_1",
      source: "input_b",
      sourceHandle: "output_input_b",
      target: "task_1",
      targetHandle: "input_in_b",
    },
    {
      id: "edge_binding_2",
      source: "input_c",
      sourceHandle: "output_input_c",
      target: "task_2",
      targetHandle: "input_in_c",
    },
  ];
}

describe("applyInputClustering", () => {
  it("hides member input nodes and injects one cluster node", () => {
    const { nodes } = applyInputClustering(
      makeNodes(),
      makeEdges(),
      makeSpec(),
    );

    expect(nodes.find((n) => n.id === "input_a")).toBeUndefined();
    expect(nodes.find((n) => n.id === "input_b")).toBeUndefined();
    // Singleton input stays as a normal node.
    expect(nodes.find((n) => n.id === "input_c")).toBeDefined();

    const clusterNode = nodes.find((n) => n.type === "inputCluster");
    expect(clusterNode).toBeDefined();
    expect(clusterNode?.selectable).toBe(false);
  });

  it("exposes one member per clustered input with resolved names", () => {
    const { nodes } = applyInputClustering(
      makeNodes(),
      makeEdges(),
      makeSpec(),
    );
    const clusterNode = nodes.find((n) => n.type === "inputCluster");
    const members = (clusterNode?.data as { members: { name: string }[] })
      .members;
    expect(members.map((m) => m.name)).toEqual(["alpha", "beta"]);
  });

  it("reroutes clustered edges to the cluster node, preserving source handles", () => {
    const { nodes, edges } = applyInputClustering(
      makeNodes(),
      makeEdges(),
      makeSpec(),
    );
    const clusterId = nodes.find((n) => n.type === "inputCluster")?.id;

    const edgeA = edges.find((e) => e.id === "edge_binding_0");
    expect(edgeA?.source).toBe(clusterId);
    expect(edgeA?.sourceHandle).toBe("output_input_a");

    // Unclustered edge is untouched.
    const edgeC = edges.find((e) => e.id === "edge_binding_2");
    expect(edgeC?.source).toBe("input_c");
  });

  it("positions the cluster at the centroid of its members when unpersisted", () => {
    const { nodes } = applyInputClustering(
      makeNodes(),
      makeEdges(),
      makeSpec(),
    );
    const clusterNode = nodes.find((n) => n.type === "inputCluster");
    // input_a at y=0, input_b at y=100 -> centroid y = 50.
    expect(clusterNode?.position).toEqual({ x: 0, y: 50 });
  });

  it("uses the persisted position when present", () => {
    const spec = makeSpec();
    const clusterNode = applyInputClustering(
      makeNodes(),
      makeEdges(),
      spec,
    ).nodes.find((n) => n.type === "inputCluster");
    const clusterId = clusterNode?.id ?? "";

    spec.annotations.set(INPUT_CLUSTERS_ANNOTATION, [
      { id: clusterId, position: { x: 42, y: 7 } },
    ]);

    const { nodes } = applyInputClustering(makeNodes(), makeEdges(), spec);
    const updated = nodes.find((n) => n.type === "inputCluster");
    expect(updated?.position).toEqual({ x: 42, y: 7 });
  });

  it("returns inputs unchanged when there is nothing to cluster", () => {
    const spec = new ComponentSpec({
      $id: "spec_1",
      name: "Test",
      inputs: [new Input({ $id: "input_a", name: "alpha" })],
    });
    const nodes: Node[] = [
      { id: "input_a", type: "input", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [];

    const result = applyInputClustering(nodes, edges, spec);
    expect(result.nodes).toBe(nodes);
    expect(result.edges).toBe(edges);
  });
});
