import { useCallback, useMemo } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { tracking } from "@/utils/tracking";
import { componentSpecToYaml } from "@/utils/yaml";

export const ExportPipelineButton = () => {
  const { componentSpec } = useComponentSpec();

  const componentText = useMemo(() => {
    try {
      return componentSpecToYaml(componentSpec);
    } catch (err) {
      console.error("Error preparing pipeline for export:", err);
      return componentSpec ? componentSpecToYaml(componentSpec) : "";
    }
  }, [componentSpec]);

  const handleExport = useCallback(() => {
    exportPipeline(componentSpec?.name ?? "Untitled Pipeline", componentText);
  }, [componentText, componentSpec?.name]);

  return (
    <ActionButton
      tooltip="Export Pipeline"
      icon="FileDown"
      onClick={handleExport}
      {...tracking("pipeline_editor.pipeline_actions.export_pipeline")}
    />
  );
};

export function exportPipeline(name: string, componentSpecYaml: string) {
  const blob = new Blob([componentSpecYaml], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const filename = name
    ? `${name}.pipeline.component.yaml`
    : "pipeline.component.yaml";

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
