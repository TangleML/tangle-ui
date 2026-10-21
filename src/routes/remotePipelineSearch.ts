export type RemotePipelineNodeType = "task" | "input" | "output";

export interface RemotePipelineSearch extends Record<string, unknown> {
  subgraphPath?: string[];
  nodeId?: string;
  nodeType?: RemotePipelineNodeType;
}

function readNodeName(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return String(value);
  return undefined;
}

export function validateRemotePipelineSearch(
  search: Record<string, unknown>,
): RemotePipelineSearch {
  return {
    ...search,
    subgraphPath:
      Array.isArray(search.subgraphPath) &&
      search.subgraphPath.every((name) => readNodeName(name) !== undefined)
        ? search.subgraphPath.map((name) => String(name))
        : undefined,
    nodeId: readNodeName(search.nodeId),
    nodeType:
      search.nodeType === "task" ||
      search.nodeType === "input" ||
      search.nodeType === "output"
        ? search.nodeType
        : undefined,
  };
}
