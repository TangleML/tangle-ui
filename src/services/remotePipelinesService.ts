import { client } from "@/api/client.gen";

export interface RemotePipeline {
  id: string;
  user_id: string;
  pipeline_name: string | null;
  created_at: string;
  updated_at: string;
  current_version: string;
}

export interface RemotePipelinesPage {
  pipelines: RemotePipeline[];
  totalCount: number;
  nextPageToken: string | null;
}

export async function listRemotePipelines(
  backendUrl: string,
  pageToken?: string,
): Promise<RemotePipelinesPage> {
  const result = await client.post<{
    200: {
      pipelines: RemotePipeline[];
      total_count: number;
      next_page_token?: string | null;
    };
  }>({
    baseUrl: backendUrl,
    url: "/api/pipelines/search",
    body: { page_size: 10, page_token: pageToken },
  });

  if (!result.data) {
    throw new Error(
      `Failed to fetch remote pipelines (${result.response.status})`,
    );
  }

  return {
    pipelines: result.data.pipelines,
    totalCount: result.data.total_count,
    nextPageToken: result.data.next_page_token ?? null,
  };
}
