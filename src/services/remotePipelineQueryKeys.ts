export const RemotePipelineQueryKeys = {
  Writer: (backendUrl: string) =>
    ["remote-pipeline-writer", backendUrl] as const,
  Deletions: (backendUrl: string) =>
    ["delete-remote-pipeline", backendUrl] as const,
  Deletion: (backendUrl: string, pipelineId: string) =>
    ["delete-remote-pipeline", backendUrl, pipelineId] as const,
  All: (backendUrl: string) => ["remote-pipelines", backendUrl] as const,
  Name: (backendUrl: string, pipelineId: string) =>
    [...RemotePipelineQueryKeys.All(backendUrl), "name", pipelineId] as const,
  Cursor: (
    backendUrl: string,
    filterQuery: string | undefined,
    token: string | undefined,
  ) =>
    [
      ...RemotePipelineQueryKeys.All(backendUrl),
      "cursor",
      filterQuery,
      token,
    ] as const,
};
