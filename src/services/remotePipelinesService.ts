import { client } from "@/api/client.gen";
import { searchPipelinesApiPipelinesSearchPost } from "@/api/remotePipelines/sdk.gen";
import type { PipelineSummaryResponse } from "@/api/remotePipelines/types.gen";

export type RemotePipeline = PipelineSummaryResponse;

export async function listRemotePipelines(
  backendUrl: string,
): Promise<RemotePipeline[]> {
  const result = await searchPipelinesApiPipelinesSearchPost({
    client,
    baseUrl: backendUrl,
    body: {},
  });

  if (!result.data) {
    throw new Error(`Failed to load pipelines (${result.response.status})`);
  }

  return result.data.pipelines;
}
