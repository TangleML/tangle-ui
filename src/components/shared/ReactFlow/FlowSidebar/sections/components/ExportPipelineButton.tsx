import { useCallback, useMemo } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
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
    const blob = new Blob([componentText], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const filename = componentSpec?.name
      ? `${componentSpec.name}.pipeline.component.yaml`
      : "pipeline.component.yaml";

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [componentText, componentSpec?.name]);

  return (
    <ActionButton
      tooltip="Export Pipeline"
      icon="FileDown"
      onClick={handleExport}
    />
  );
};
