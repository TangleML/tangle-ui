import { generate } from "random-words";

import { exportPipeline } from "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton";
import {
  serializeComponentSpec,
  serializeComponentSpecToYaml,
} from "@/models/componentSpec";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import { writeComponentToFileListFromText } from "@/utils/componentStore";
import {
  defaultPipelineYamlWithName,
  USER_PIPELINES_LIST_NAME,
} from "@/utils/constants";
import { componentSpecToYaml } from "@/utils/yaml";

export async function createNewPipeline(): Promise<string> {
  const name = (generate(4) as string[]).join(" ");
  const componentText = defaultPipelineYamlWithName(name);
  await writeComponentToFileListFromText(
    USER_PIPELINES_LIST_NAME,
    name,
    componentText,
  );
  return name;
}

export async function savePipelineAs(
  navigation: NavigationStore,
  newName: string,
): Promise<void> {
  const componentSpec = navigation.rootSpec;

  if (!componentSpec) return;

  const serialized = {
    ...serializeComponentSpec(componentSpec),
    name: newName,
  };
  const componentText = componentSpecToYaml(serialized);

  await writeComponentToFileListFromText(
    USER_PIPELINES_LIST_NAME,
    newName,
    componentText,
  );
}

export function exportCurrentPipeline(navigation: NavigationStore): void {
  const componentSpec = navigation.rootSpec;

  if (!componentSpec) return;

  const componentText = serializeComponentSpecToYaml(componentSpec);
  exportPipeline(componentSpec.name ?? "Untitled Pipeline", componentText);
}
