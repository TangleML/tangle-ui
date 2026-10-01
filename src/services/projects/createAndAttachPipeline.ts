import { createNewPipeline } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/fileMenu.actions";
import { availablePipelineName } from "@/services/localPipelines/localPipelinesService";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";

import { localPipelineResourceInput } from "./resourceDescriptor";
import type { CreateResourceInput } from "./types";

interface CreateAndAttachOptions {
  storage: PipelineStorageService;
  name?: string;
  provisionalName?: boolean;
  attach: (input: CreateResourceInput) => Promise<unknown>;
}

/**
 * A pipeline is made in this browser and then named on the project, which are
 * two stores and two failures. Left alone, a refused attach strands a pipeline
 * the caller never asked for in browser storage — invisible, because nothing
 * lists a pipeline by what it is not attached to.
 *
 * So the file is deleted again if the attach is refused, and the refusal is
 * what the caller sees. Losing the pipeline is right here: it holds nothing
 * anyone has typed, and the caller is about to be told the whole thing failed.
 */
export async function createAndAttachPipeline({
  storage,
  name,
  provisionalName = false,
  attach,
}: CreateAndAttachOptions): Promise<PipelineFile> {
  const file = await createNewPipeline(
    storage,
    name ? await availablePipelineName(name) : undefined,
    { provisionalName },
  );

  try {
    await attach(
      localPipelineResourceInput({
        localName: file.storageKey,
        localId: file.id,
      }),
    );
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
