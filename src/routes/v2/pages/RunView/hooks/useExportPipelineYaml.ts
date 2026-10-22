import type { ComponentSpec } from "@/utils/componentSpec";
import { downloadStringAsFile } from "@/utils/URL";
import { componentSpecToYaml } from "@/utils/yaml";

export function useExportPipelineYaml(
  componentSpec?: ComponentSpec,
  pipelineName?: string,
) {
  const exportYaml = () => {
    if (!componentSpec) return;
    const yaml = componentSpecToYaml(componentSpec);
    const name = pipelineName ?? componentSpec.name ?? "Untitled Pipeline";
    downloadStringAsFile(yaml, `${name}.pipeline.component.yaml`, "text/yaml");
  };

  return { exportYaml };
}
