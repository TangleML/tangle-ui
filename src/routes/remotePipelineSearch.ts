export type RemotePipelineNodeType = "task" | "input" | "output";

export interface RemotePipelineSearch extends Record<string, unknown> {
  subgraphPath?: string[];
  nodeId?: string;
  nodeType?: RemotePipelineNodeType;
}

export function validateRemotePipelineSearch(
  search: Record<string, unknown>,
): RemotePipelineSearch {
  return {
    ...search,
    subgraphPath:
      Array.isArray(search.subgraphPath) &&
      search.subgraphPath.every(
        (name): name is string => typeof name === "string",
      )
        ? search.subgraphPath
        : undefined,
    nodeId: typeof search.nodeId === "string" ? search.nodeId : undefined,
    nodeType:
      search.nodeType === "task" ||
      search.nodeType === "input" ||
      search.nodeType === "output"
        ? search.nodeType
        : undefined,
  };
}
