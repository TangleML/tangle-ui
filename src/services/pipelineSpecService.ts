import { client } from "@/api/client.gen";
import type { ComponentSpec } from "@/utils/componentSpec";

export class PipelineSpecApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PipelineSpecApiError";
    this.status = status;
  }
}

/**
 * `GET /api/pipelines/{id}` is absent from the generated client, whose
 * checked-in copy predates it. Regenerating pulls in every operation of
 * whatever backend happens to be running, so this one call is written out by
 * hand against the `client` that `BackendProvider` already configures.
 */
interface SavedPipelineDto {
  id: string;
  file_path: string;
  pipeline_name: string | null;
  root_pipeline_task: { componentRef?: { spec?: ComponentSpec } } | null;
}

export interface SavedPipeline {
  editorName: string;
  spec: ComponentSpec;
}

export async function getPipelineSpec(
  pipelineId: string,
): Promise<SavedPipeline> {
  const result = await client.get<{ 200: SavedPipelineDto }>({
    url: "/api/pipelines/{pipeline_id}",
    path: { pipeline_id: pipelineId },
  });

  if (!result.data) {
    throw new PipelineSpecApiError(
      `Failed to fetch pipeline ${pipelineId}`,
      result.response.status,
    );
  }

  const spec = result.data.root_pipeline_task?.componentRef?.spec;

  if (!spec) {
    throw new PipelineSpecApiError(
      `Pipeline ${pipelineId} holds no component spec`,
      result.response.status,
    );
  }

  return { editorName: result.data.file_path, spec };
}
