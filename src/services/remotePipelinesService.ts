import { client } from "@/api/client.gen";
import { searchPipelinesApiPipelinesSearchPost } from "@/api/remotePipelines/sdk.gen";
import type { PipelineSummaryResponse } from "@/api/remotePipelines/types.gen";

export type RemotePipeline = PipelineSummaryResponse;

export interface RemotePipelinesPage {
  pipelines: RemotePipeline[];
  nextPageToken: string | null;
}

export async function listRemotePipelines(
  backendUrl: string,
  pageToken?: string,
): Promise<RemotePipelinesPage> {
  const result = await searchPipelinesApiPipelinesSearchPost({
    client,
    baseUrl: backendUrl,
    body: { page_size: 10, page_token: pageToken },
  });

  if (!result.data) {
    throw new Error(`Failed to load pipelines (${result.response.status})`);
  }

  return {
    pipelines: result.data.pipelines,
    nextPageToken: result.data.next_page_token ?? null,
  };
}
