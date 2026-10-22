import { client } from "@/api/client.gen";
import {
  type ComponentSpec,
  isValidComponentSpec,
  type TaskSpec,
} from "@/utils/componentSpec";

import { normalizePipelineId } from "./pipelineId";
import { describeErrorBody } from "./requestFailureMessage";

export class PipelineSpecApiError extends Error {
  readonly status: number;
  readonly kind: "unsupported" | "notFound" | "unavailable" | "other";

  constructor(
    message: string,
    status: number,
    kind: PipelineSpecApiError["kind"] = status === 404
      ? "notFound"
      : status === 405 || status === 501
        ? "unsupported"
        : status === 0 || status >= 500 || status === 408 || status === 429
          ? "unavailable"
          : "other",
  ) {
    super(message);
    this.name = "PipelineSpecApiError";
    this.status = status;
    this.kind = kind;
  }
}

export function pipelineApiError(
  action: string,
  status: number,
  error?: unknown,
): PipelineSpecApiError {
  const detail =
    error && typeof error === "object" && "detail" in error
      ? error.detail
      : undefined;
  const unsupported =
    status === 405 ||
    status === 501 ||
    (status === 404 && detail === "Not Found");
  const description = describeErrorBody(error);
  const result = new PipelineSpecApiError(
    `${action} (${status})${description ? `: ${description}` : ""}`,
    status,
    unsupported ? "unsupported" : undefined,
  );
  if (result.kind === "unsupported")
    result.message = `${action} (${status}). This backend does not support saved pipelines.`;
  else if (result.kind === "unavailable")
    result.message +=
      ". The backend is unavailable. Try again when the connection is restored.";
  return result;
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
  const result = await client
    .get<{ 200: SavedPipelineDocument }>({
      ...(backendUrl ? { baseUrl: backendUrl } : {}),
      url: "/api/pipelines/{pipeline_id}",
      path: { pipeline_id: normalizedId },
    })
    .catch(() => {
      throw pipelineApiError("Failed to load pipeline", 0);
    });

  if (!result.data) {
    throw pipelineApiError(
      "Failed to load pipeline",
      result.response?.status ?? 0,
      result.error,
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
