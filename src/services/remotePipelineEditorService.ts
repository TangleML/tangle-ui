import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import type { SavedPipelineDocument } from "@/services/pipelineSpecService";
import { isValidComponentSpec } from "@/utils/componentSpec";

type RemotePipelineWrite = Pick<
  SavedPipelineDocument,
  "root_pipeline_task" | "pipeline_run_annotations"
>;

function apiError(action: string, status: number, error: unknown): Error {
  const detail =
    error && typeof error === "object" && "detail" in error
      ? error.detail
      : undefined;
  return new Error(
    `${action} (${status})${typeof detail === "string" ? `: ${detail}` : ""}`,
  );
}

function validateDocument(document: SavedPipelineDocument): void {
  if (!isValidComponentSpec(document.root_pipeline_task?.componentRef?.spec)) {
    throw new Error("This pipeline has no embedded component spec to edit.");
  }
}

export async function getRemotePipelineWriter(
  backendUrl: string,
): Promise<string> {
  const result = await getCurrentUserApiUsersMeGet({ baseUrl: backendUrl });
  if (!result.response.ok || !result.data?.id) {
    throw apiError(
      "Unable to verify your editing permissions",
      result.response.status,
      result.error,
    );
  }
  if (!result.data.permissions.includes("write")) {
    throw new Error("You do not have permission to edit pipelines.");
  }
  return result.data.id;
}

export function assertRemotePipelineOwner(
  document: SavedPipelineDocument,
  userId: string,
): void {
  if (document.user_id !== userId) {
    throw new Error("You can only edit pipelines that you own.");
  }
}

export async function writeRemotePipelineDocument(
  backendUrl: string,
  filePath: string,
  content: RemotePipelineWrite,
): Promise<SavedPipelineDocument> {
  // Omit versioning_mode so an ordinary save preserves the server's policy.
  const result = await client.put<{ 200: SavedPipelineDocument }>({
    baseUrl: backendUrl,
    url: "/api/users/me/pipelines",
    query: { file_path: filePath },
    body: content,
  });
  if (!result.response.ok || !result.data) {
    throw apiError(
      "Failed to save pipeline",
      result.response.status,
      result.error,
    );
  }
  validateDocument(result.data);
  if (result.data.file_path !== filePath) {
    throw new Error(
      "The backend saved the pipeline at an unexpected file path.",
    );
  }
  return result.data;
}
