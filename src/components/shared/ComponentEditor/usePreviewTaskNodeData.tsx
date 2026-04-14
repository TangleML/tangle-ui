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

    // Use a synthetic digest stable per component name. This means the
    // React Query hydration cache key ("digest:preview:<name>") stays
    // constant while editing the component body, so TaskNodeProvider's
    // useHydrateComponentReference never sees a new query key and never
    // suspends on keystrokes.
    const digest = `preview:${name}`;

    const componentRef: HydratedComponentReference = {
      text: componentText,
      spec,
      name,
      digest,
    };

    // Pre-populate the hydration cache before TaskNodeProvider renders.
    // This runs during the parent render (top-down), so the entry is
    // present when TaskNodeProvider's useSuspenseQuery executes.
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
