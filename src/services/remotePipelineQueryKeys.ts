export const RemotePipelineQueryKeys = {
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
