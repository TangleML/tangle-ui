import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import {
  pipelineApiError,
  PipelineSpecApiError,
  type SavedPipelineDocument,
} from "@/services/pipelineSpecService";
import { isValidComponentSpec } from "@/utils/componentSpec";

type RemotePipelineWrite = Pick<
  SavedPipelineDocument,
  "root_pipeline_task" | "pipeline_run_annotations"
>;

function validateDocument(document: SavedPipelineDocument): void {
  if (!isValidComponentSpec(document.root_pipeline_task?.componentRef?.spec)) {
    throw new Error("This pipeline has no embedded component spec to edit.");
  }
}

export async function getRemotePipelineWriter(
  backendUrl: string,
): Promise<string> {
  const result = await getCurrentUserApiUsersMeGet({
    baseUrl: backendUrl,
  }).catch(() => {
    throw pipelineApiError("Unable to verify your editing permissions", 0);
  });
  if (!result.response?.ok || !result.data?.id) {
    throw pipelineApiError(
      "Unable to verify your editing permissions",
      result.response?.status ?? 0,
      result.error,
    );
  }
  if (!result.data.permissions.includes("write")) {
    throw new PipelineSpecApiError(
      "You do not have permission to edit pipelines.",
      403,
    );
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
  const result = await client
    .put<{ 200: SavedPipelineDocument }>({
      baseUrl: backendUrl,
      url: "/api/users/me/pipelines",
      query: { file_path: filePath },
      body: content,
    })
    .catch(() => {
      throw pipelineApiError("Failed to save pipeline", 0);
    });
  if (!result.response?.ok || !result.data) {
    throw pipelineApiError(
      "Failed to save pipeline",
      result.response?.status ?? 0,
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

export async function findRemotePipelineDocumentByPath(
  backendUrl: string,
  filePath: string,
): Promise<SavedPipelineDocument | undefined> {
  const result = await client
    .get<{ 200: SavedPipelineDocument }>({
      baseUrl: backendUrl,
      url: "/api/users/me/pipelines",
      query: { file_path: filePath },
    })
    .catch(() => {
      throw pipelineApiError("Failed to check for an earlier upload", 0);
    });
  if (!result.response?.ok || !result.data) {
    const error = pipelineApiError(
      "Failed to check for an earlier upload",
      result.response?.status ?? 0,
      result.error,
    );
    if (error.kind === "notFound") return undefined;
    throw error;
  }
  validateDocument(result.data);
  if (result.data.file_path !== filePath) {
    throw new Error("The backend returned a different pipeline file.");
  }
  return result.data;
}
