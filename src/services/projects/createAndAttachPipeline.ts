import { createNewPipeline } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/fileMenu.actions";
import { availablePipelineName } from "@/services/localPipelines/localPipelinesService";
import { getPipelineCreationBackendUrl } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import { isGraphImplementation } from "@/utils/componentSpec";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import {
  pipelineFileResourceInput,
  remotePipelineResourceInput,
} from "./pipelineResource";
import type { CreateResourceInput } from "./types";

type Attach = (input: CreateResourceInput) => Promise<unknown>;

interface CreateAndAttachOptions {
  storage: PipelineStorageService;
  name?: string;
  provisionalName?: boolean;
  attach: Attach;
}

interface ImportAndAttachOptions {
  storage: PipelineStorageService;
  yaml: string;
  name?: string;
  attach: Attach;
}

/**
 * Remote drafts are attached on their first save. Local creation attaches
 * immediately and removes the empty file if the project refuses it.
 */
async function attachOrCleanup(
  file: PipelineFile,
  attach: Attach,
): Promise<PipelineFile> {
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

export async function createAndAttachPipeline({
  storage,
  name,
  provisionalName = false,
  attach,
}: CreateAndAttachOptions): Promise<PipelineFile> {
  const backendUrl = await getPipelineCreationBackendUrl();
  const file: PipelineFile = await createNewPipeline(
    storage,
    name && !backendUrl ? await availablePipelineName(name) : name,
    {
      provisionalName,
      destination: { backendUrl },
      onRemoteCreated: (remote) =>
        attach(remotePipelineResourceInput(remote.pipelineId, file.storageKey)),
    },
  );

  // The driver awaits attachment, so failures remain retryable through autosave.
  if (file.isDraft) return file;

  return attachOrCleanup(file, attach);
}

export async function importAndAttachPipeline({
  storage,
  yaml,
  name,
  attach,
}: ImportAndAttachOptions): Promise<PipelineFile> {
  const componentSpec = componentSpecFromYaml(yaml);
  if (!isGraphImplementation(componentSpec.implementation)) {
    throw new Error(
      "This does not look like a pipeline: its implementation is not a graph.",
    );
  }

  const storageKey = await availablePipelineName(
    name ?? componentSpec.name ?? "Imported Pipeline",
  );
  componentSpec.name = storageKey;

  const file = await storage.rootFolder.addFile(
    storageKey,
    componentSpecToYaml(componentSpec),
  );

  return attachOrCleanup(file, attach);
}
