import { createNewPipeline } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/fileMenu.actions";
import { getPipelineCreationBackendUrl } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";

import { remotePipelineResourceInput } from "./pipelineResource";
import type { CreateResourceInput } from "./types";

interface CreateAndAttachOptions {
  storage: PipelineStorageService;
  name?: string;
  provisionalName?: boolean;
  attach: (input: CreateResourceInput) => Promise<unknown>;
}

/** A project receives its pipeline resource after the first remote save. */
export async function createAndAttachPipeline({
  storage,
  name,
  provisionalName = false,
  attach,
}: CreateAndAttachOptions): Promise<PipelineFile> {
  const backendUrl = await getPipelineCreationBackendUrl();
  const file: PipelineFile = await createNewPipeline(storage, name, {
    provisionalName,
    destination: { backendUrl },
    onRemoteCreated: (remote) =>
      attach(remotePipelineResourceInput(remote.pipelineId, file.name)),
  });

  return file;
}
