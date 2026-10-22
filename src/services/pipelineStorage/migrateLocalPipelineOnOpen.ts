import { PipelineMigrationRecoveryError } from "@/services/pipelineStorage/migrateLocalPipelineToRemote";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { findPipelineMigration } from "@/services/pipelineStorage/pipelineMigrations";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import type { PipelineRef } from "@/services/pipelineStorage/types";
import { ProjectResourcesApiError } from "@/services/projects/errors";
import { moveLocalPipelineResourceToRemote } from "@/services/projects/moveLocalPipelineResourceToRemote";

export async function migrateLocalPipelineOnOpen(
  storage: PipelineStorageService,
  local: PipelineFile,
  ref: PipelineRef,
  backendUrl: string,
  projectId?: string,
): Promise<{
  file: PipelineFile;
  warning?: string;
  hasLocalChanges?: boolean;
  projectUnavailable?: boolean;
}> {
  let warning: string | undefined;
  let projectUnavailable = false;
  const repair = async (remote: PipelineFile) => {
    if (!projectId) return;
    const localId = local.remote
      ? (ref.fileId ?? (await findPipelineMigration(ref))?.localId)
      : local.id;
    try {
      await moveLocalPipelineResourceToRemote(
        projectId,
        {
          id: localId ?? "",
          storageKey: ref.name,
        },
        remote,
        backendUrl,
      );
    } catch (error) {
      if (
        !(error instanceof ProjectResourcesApiError) ||
        (error.status !== 403 && error.status !== 404)
      )
        throw error;
      projectUnavailable = true;
      warning =
        "The pipeline opened, but its former project is not accessible. Its project link was left unchanged.";
    }
  };
  try {
    const file = local.remote
      ? local
      : await storage.moveLocalPipelineToRemote(
          local,
          backendUrl,
          projectId ? repair : undefined,
        );
    if (local.remote) await repair(file);
    return { file, warning, projectUnavailable };
  } catch (error) {
    if (error instanceof PipelineMigrationRecoveryError) {
      return {
        file: error.remote,
        warning: [warning, error.message].filter(Boolean).join(" "),
        hasLocalChanges: error.hasLocalChanges,
        projectUnavailable,
      };
    }
    if (local.remote) {
      return {
        file: local,
        warning:
          "The saved pipeline opened, but its project link could not be updated. Reopen the original link to retry the repair.",
      };
    }
    throw error;
  }
}
