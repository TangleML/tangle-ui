import yaml from "js-yaml";

import type { ComponentSpec } from "@/utils/componentSpec";
import { isValidComponentSpec } from "@/utils/componentSpec";
import { componentSpecToYaml, PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

export const preserveComponentName = (
  yamlText: string,
  preservedName?: string,
): string => {
  if (!preservedName || !preservedName.trim()) {
    return yamlText;
  }

  try {
    const parsed = yaml.load(yamlText, PIPELINE_YAML_LOAD_OPTIONS);

    if (isValidComponentSpec(parsed)) {
      const updatedSpec: ComponentSpec = {
        ...parsed,
        name: preservedName,
      };

      return componentSpecToYaml(updatedSpec);
    }
  } catch (error) {
    console.error("Failed to preserve component name:", error);
  }

  return yamlText;
};
