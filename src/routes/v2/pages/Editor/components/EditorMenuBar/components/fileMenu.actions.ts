import { generate } from "random-words";

import { exportPipeline } from "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton";
import { JsonSerializer } from "@/models/componentSpec/serialization/jsonSerializer";
import { navigationStore } from "@/routes/v2/shared/store/navigationStore";
import { type ComponentSpec as WiredComponentSpec } from "@/utils/componentSpec";
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

export function exportCurrentPipeline(): void {
  const serializer = new JsonSerializer();
  const componentSpec = navigationStore.rootSpec;

  if (!componentSpec) return;

  const componentText = componentSpecToYaml(
    serializer.serialize(componentSpec) as WiredComponentSpec,
  );
  exportPipeline(componentSpec.name ?? "Untitled Pipeline", componentText);
}
