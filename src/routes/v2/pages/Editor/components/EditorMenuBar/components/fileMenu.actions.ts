import { generate } from "random-words";

import {
  serializeComponentSpec,
  serializeComponentSpecToYaml,
} from "@/models/componentSpec";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import {
  getPipelineCreationBackendUrl,
  type PipelineCreationDestination,
} from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import type { RemotePipelineRef } from "@/services/pipelineStorage/types";
import { downloadStringAsFile } from "@/utils/URL";

export async function createNewPipeline(
  storage: PipelineStorageService,
  name = (generate(4) as string[]).join(" "),
  {
    provisionalName = false,
    onRemoteCreated,
    destination,
  }: {
    provisionalName?: boolean;
    onRemoteCreated?: (ref: RemotePipelineRef) => Promise<unknown>;
    destination?: PipelineCreationDestination;
  } = {},
): Promise<PipelineFile> {
  const backendUrl = destination
    ? destination.backendUrl
    : await getPipelineCreationBackendUrl();
  return storage.createRemoteDraft(
    {
      source: "draft",
      backendUrl,
      draftId: crypto.randomUUID(),
      name,
      provisionalName,
    },
    onRemoteCreated,
  );
}

export async function savePipelineAs(
  navigation: NavigationStore,
  newName: string,
  storage: PipelineStorageService,
  sourceFile?: PipelineFile | null,
  destination?: PipelineCreationDestination,
): Promise<PipelineFile | undefined> {
  const componentSpec = navigation.rootSpec;
  if (!componentSpec) return undefined;

  const serialized = {
    ...serializeComponentSpec(componentSpec),
    name: newName,
  };

  const configuredBackendUrl = destination
    ? destination.backendUrl
    : await getPipelineCreationBackendUrl();
  if (sourceFile?.remote)
    return storage.copyRemotePipeline(sourceFile, newName, serialized);
  const backendUrl = sourceFile?.backendUrl ?? configuredBackendUrl;
  return storage.createRemotePipeline(backendUrl, newName, serialized);
}

export function exportCurrentPipeline(navigation: NavigationStore): void {
  const componentSpec = navigation.rootSpec;
  if (!componentSpec) return;

  const componentText = serializeComponentSpecToYaml(componentSpec);
  downloadStringAsFile(
    componentText,
    `${componentSpec.name ?? "Untitled Pipeline"}.pipeline.component.yaml`,
    "text/yaml",
  );
}
