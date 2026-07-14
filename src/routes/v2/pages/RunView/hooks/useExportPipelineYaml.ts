import { exportPipeline } from "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton";
import type { ComponentSpec } from "@/utils/componentSpec";
import { componentSpecToYaml } from "@/utils/yaml";

export function useExportPipelineYaml(
  componentSpec?: ComponentSpec,
  pipelineName?: string,
) {
  const exportYaml = () => {
    if (!componentSpec) return;
    const yaml = componentSpecToYaml(componentSpec);
    exportPipeline(
      pipelineName ?? componentSpec.name ?? "Untitled Pipeline",
      yaml,
    );
  };

  return { exportYaml };
}
