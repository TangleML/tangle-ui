export const RemotePipelineQueryKeys = {
  Writer: (backendUrl: string) =>
    ["remote-pipeline-writer", backendUrl] as const,
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
