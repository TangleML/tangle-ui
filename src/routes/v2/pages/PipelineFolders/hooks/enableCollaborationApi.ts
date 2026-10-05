import { client } from "@/api/client.gen";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { sanitizeSpecForBackend } from "@/utils/sanitizeSpecForBackend";
import { componentSpecFromYaml } from "@/utils/yaml";

class EnableCollaborationApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EnableCollaborationApiError";
    this.status = status;
  }
}

interface PipelineWriteResponseDto {
  id: string;
  file_path: string;
}

function isPipelineWriteResponse(
  value: unknown,
): value is PipelineWriteResponseDto {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string"
  );
}

/**
 * Upserts the pipeline's current document to the backend so collaboration can
 * key a room on its stable id. The `user_pipelines` operations are absent from
 * the generated client, so this is written out by hand against the configured
 * `client`, mirroring `src/services/pipelineSpecService.ts`.
 */
export async function enableCollaboration(file: PipelineFile): Promise<string> {
  const spec = sanitizeSpecForBackend(componentSpecFromYaml(await file.read()));

  const result = await client.put<{ 200: PipelineWriteResponseDto }>({
    url: "/api/users/me/pipelines",
    query: { file_path: file.storageKey },
    body: { root_pipeline_task: { componentRef: { spec } } },
  });

  if (!isPipelineWriteResponse(result.data)) {
    throw new EnableCollaborationApiError(
      `Failed to enable collaboration for "${file.storageKey}"`,
      result.response.status,
    );
  }

  return result.data.id;
}
