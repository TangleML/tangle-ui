export const RemotePipelineQueryKeys = {
  Deletions: (backendUrl: string) =>
    ["delete-remote-pipeline", backendUrl] as const,
  Deletion: (backendUrl: string, pipelineId: string) =>
    ["delete-remote-pipeline", backendUrl, pipelineId] as const,
  All: (backendUrl: string) => ["remote-pipelines", backendUrl] as const,
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
