export const RemotePipelineQueryKeys = {
  Writer: (backendUrl: string) =>
    ["remote-pipeline-writer", backendUrl] as const,
};
