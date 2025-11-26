import yaml from "js-yaml";

import type { ComponentSpec } from "@/utils/componentSpec";
import { isValidComponentSpec } from "@/utils/componentSpec";

export const preserveComponentName = (
  yamlText: string,
  preservedName?: string,
): string => {
  if (!preservedName || !preservedName.trim()) {
    return yamlText;
  }

  try {
    const parsed = yaml.load(yamlText);

    if (isValidComponentSpec(parsed)) {
      const updatedSpec: ComponentSpec = {
        ...parsed,
        name: preservedName,
      };

      return yaml.dump(updatedSpec, { lineWidth: 10000 });
    }
  } catch (error) {
    console.error("Failed to preserve component name:", error);
  }

  return yamlText;
};
