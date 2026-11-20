import type { Edge, Node } from "@xyflow/react";

interface EmbeddedInputsResult {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Hides input nodes that have at least one outgoing connection (and the edges
 * leaving them), keeping unconnected inputs visible as standalone nodes.
 *
 * Task nodes already render each input's value inline, so a connected input's
 * value stays visible on its consuming task once the standalone node is hidden.
 * Returns the inputs unchanged when nothing is connected so React Flow keeps
 * stable references.
 */
export function applyEmbeddedInputs(
  nodes: Node[],
  edges: Edge[],
): EmbeddedInputsResult {
  const inputIds = new Set(
    nodes.filter((node) => node.type === "input").map((node) => node.id),
  );

  const connectedInputIds = new Set(
    edges.map((edge) => edge.source).filter((source) => inputIds.has(source)),
  );

  if (connectedInputIds.size === 0) return { nodes, edges };

  return {
    nodes: nodes.filter((node) => !connectedInputIds.has(node.id)),
    edges: edges.filter((edge) => !connectedInputIds.has(edge.source)),
  };
}
