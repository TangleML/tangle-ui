export const RemotePipelineQueryKeys = {
  All: (backendUrl: string) => ["remote-pipelines", backendUrl] as const,
  Page: (backendUrl: string, filterQuery: string | undefined, page: number) =>
    [
      ...RemotePipelineQueryKeys.All(backendUrl),
      "page",
      filterQuery,
      page,
    ] as const,
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
