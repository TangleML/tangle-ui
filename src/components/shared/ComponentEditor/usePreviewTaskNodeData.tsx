import { useQueryClient } from "@tanstack/react-query";

import type { TaskNodeData } from "@/types/taskNode";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import { generateTaskSpec } from "@/utils/nodes/generateTaskSpec";
import { componentSpecFromYaml } from "@/utils/yaml";

export const usePreviewTaskNodeData = (
  componentText: string,
): TaskNodeData | false => {
  const queryClient = useQueryClient();

  try {
    const spec = componentSpecFromYaml(componentText);
    const name = spec.name ?? "component-preview";

    const digest = `preview:${name}`;

    const componentRef: HydratedComponentReference = {
      text: componentText,
      spec,
      name,
      digest,
    };

    queryClient.setQueryData(
      ["component", "hydrate", `digest:${digest}`],
      componentRef,
    );

    const taskSpec = generateTaskSpec(componentRef);
    return {
      taskSpec,
      taskId: `preview-${name}`,
      isGhost: false,
      readOnly: true,
    };
  } catch {
    return false;
  }
};
