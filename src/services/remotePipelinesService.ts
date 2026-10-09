import { client } from "@/api/client.gen";

export interface RemotePipeline {
  id: string;
  user_id: string;
  pipeline_name: string | null;
  created_at: string;
  updated_at: string;
  current_version: string;
}

export async function listRemotePipelines(
  backendUrl: string,
): Promise<RemotePipeline[]> {
  const result = await client.get<{
    200: { pipelines: RemotePipeline[] };
  }>({
    baseUrl: backendUrl,
    url: "/api/pipelines/search",
  });

  if (!result.data) {
    throw new Error(
      `Failed to fetch remote pipelines (${result.response.status})`,
    );
  }

  return result.data.pipelines;
}
