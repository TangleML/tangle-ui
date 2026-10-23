import { createNewPipeline } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/fileMenu.actions";
import { availablePipelineName } from "@/services/localPipelines/localPipelinesService";
import { createsLocalPipelines } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";

import {
  pipelineFileResourceInput,
  remotePipelineResourceInput,
} from "./pipelineResource";
import type { CreateResourceInput } from "./types";

interface CreateAndAttachOptions {
  storage: PipelineStorageService;
  name?: string;
  provisionalName?: boolean;
  attach: (input: CreateResourceInput) => Promise<unknown>;
}

/**
 * Remote drafts are attached on their first save. Local creation attaches
 * immediately and removes the empty file if the project refuses it.
 */
export async function createAndAttachPipeline({
  storage,
  name,
  provisionalName = false,
  attach,
}: CreateAndAttachOptions): Promise<PipelineFile> {
  const file: PipelineFile = await createNewPipeline(
    storage,
    name && createsLocalPipelines() ? await availablePipelineName(name) : name,
    {
      provisionalName,
      onRemoteCreated: (remote) =>
        attach(remotePipelineResourceInput(remote.pipelineId, file.storageKey)),
    },
  );

  // The driver awaits attachment, so failures remain retryable through autosave.
  if (file.isDraft) return file;

  try {
    await attach(pipelineFileResourceInput(file));
  } catch (error) {
    await file
      .deleteFile()
      .catch((cleanupError: unknown) =>
        console.error(
          "Failed to remove the pipeline whose project attachment was refused",
          cleanupError,
        ),
      );
    throw error;
  }

  return file;
}
