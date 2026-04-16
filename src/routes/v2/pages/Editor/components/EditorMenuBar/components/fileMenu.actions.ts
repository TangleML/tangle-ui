import { generate } from "random-words";

import { exportPipeline } from "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton";
import {
  serializeComponentSpec,
  serializeComponentSpecToYaml,
} from "@/models/componentSpec";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import { defaultPipelineYamlWithName } from "@/utils/constants";
import { componentSpecToYaml } from "@/utils/yaml";

export async function createNewPipeline(
  storage: PipelineStorageService,
): Promise<PipelineFile> {
  const name = (generate(4) as string[]).join(" ");
  const componentText = defaultPipelineYamlWithName(name);

  return storage.rootFolder.addFile(name, componentText);
}

export async function savePipelineAs(
  navigation: NavigationStore,
  newName: string,
  storage: PipelineStorageService,
): Promise<PipelineFile | undefined> {
  const componentSpec = navigation.rootSpec;
  if (!componentSpec) return undefined;

  const serialized = {
    ...serializeComponentSpec(componentSpec),
    name: newName,
  };
  const componentText = componentSpecToYaml(serialized);

  return storage.rootFolder.addFile(newName, componentText);
}

export function exportCurrentPipeline(navigation: NavigationStore): void {
  const componentSpec = navigation.rootSpec;
  if (!componentSpec) return;

  const componentText = serializeComponentSpecToYaml(componentSpec);
  exportPipeline(componentSpec.name ?? "Untitled Pipeline", componentText);
}
