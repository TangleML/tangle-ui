import { client } from "@/api/client.gen";
import {
  type ComponentSpec,
  isValidComponentSpec,
  type TaskSpec,
} from "@/utils/componentSpec";

import { normalizePipelineId } from "./pipelineId";

export class PipelineSpecApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PipelineSpecApiError";
    this.status = status;
  }
}

// The generated clients do not yet include the saved-pipeline GET endpoint.
export interface SavedPipelineDocument {
  id: string;
  file_path: string;
  pipeline_name: string | null;
  user_id: string;
  pipeline_run_annotations: Record<string, string>;
  root_pipeline_task: TaskSpec & { componentRef: { spec: ComponentSpec } };
}

export interface SavedPipeline {
  editorName: string;
  spec: ComponentSpec;
}

export async function getPipelineDocument(
  pipelineId: string,
  backendUrl?: string,
): Promise<SavedPipelineDocument> {
  const normalizedId = normalizePipelineId(pipelineId);
  const result = await client.get<{ 200: SavedPipelineDocument }>({
    ...(backendUrl ? { baseUrl: backendUrl } : {}),
    url: "/api/pipelines/{pipeline_id}",
    path: { pipeline_id: normalizedId },
  });

  if (!result.data) {
    throw new PipelineSpecApiError(
      `Failed to fetch pipeline ${pipelineId} (${result.response.status})`,
      result.response.status,
    );
  }

  const spec = result.data.root_pipeline_task?.componentRef?.spec;

  if (!isValidComponentSpec(spec)) {
    throw new PipelineSpecApiError(
      `Pipeline ${pipelineId} holds no component spec`,
      result.response.status,
    );
  }

  if (
    typeof result.data.id !== "string" ||
    normalizePipelineId(result.data.id) !== normalizedId
  ) {
    throw new PipelineSpecApiError(
      "The backend returned a different pipeline.",
      result.response.status,
    );
  }
  return result.data;
}

export async function getPipelineSpec(
  pipelineId: string,
  backendUrl?: string,
): Promise<SavedPipeline> {
  const document = await getPipelineDocument(pipelineId, backendUrl);
  return {
    editorName: document.file_path,
    spec: document.root_pipeline_task.componentRef.spec,
  };
}
