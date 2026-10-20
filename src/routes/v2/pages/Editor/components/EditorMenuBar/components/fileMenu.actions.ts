import { generate } from "random-words";

import { exportPipeline } from "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton";
import {
  serializeComponentSpec,
  serializeComponentSpecToYaml,
} from "@/models/componentSpec";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import { getPipelineCreationBackendUrl } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import type { RemotePipelineRef } from "@/services/pipelineStorage/types";
import { defaultPipelineYamlWithName } from "@/utils/constants";
import { componentSpecToYaml } from "@/utils/yaml";

export async function createNewPipeline(
  storage: PipelineStorageService,
  name = (generate(4) as string[]).join(" "),
  {
    provisionalName = false,
    onRemoteCreated,
  }: {
    provisionalName?: boolean;
    onRemoteCreated?: (ref: RemotePipelineRef) => Promise<unknown>;
  } = {},
): Promise<PipelineFile> {
  const backendUrl = await getPipelineCreationBackendUrl();
  if (backendUrl) {
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
  const componentText = defaultPipelineYamlWithName(name, { provisionalName });

  return storage.rootFolder.addFile(name, componentText);
}

export async function savePipelineAs(
  navigation: NavigationStore,
  newName: string,
  storage: PipelineStorageService,
  sourceFile?: PipelineFile | null,
): Promise<PipelineFile | undefined> {
  const componentSpec = navigation.rootSpec;
  if (!componentSpec) return undefined;

  const serialized = {
    ...serializeComponentSpec(componentSpec),
    name: newName,
  };
  const componentText = componentSpecToYaml(serialized);

  const configuredBackendUrl = await getPipelineCreationBackendUrl();
  if (!configuredBackendUrl)
    return storage.rootFolder.addFile(newName, componentText);

  if (sourceFile?.remote)
    return storage.copyRemotePipeline(sourceFile, newName, componentText);
  const backendUrl = sourceFile?.draftBackendUrl ?? configuredBackendUrl;
  return storage.createRemotePipeline(backendUrl, newName, componentText);
}

export function exportCurrentPipeline(navigation: NavigationStore): void {
  const componentSpec = navigation.rootSpec;
  if (!componentSpec) return;

  const componentText = serializeComponentSpecToYaml(componentSpec);
  exportPipeline(componentSpec.name ?? "Untitled Pipeline", componentText);
}
