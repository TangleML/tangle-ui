import type { XYPosition } from "@xyflow/react";

import useToastNotification from "@/hooks/useToastNotification";
import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { hydrateComponentReference } from "@/services/componentService";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import { readTextFromFile } from "@/utils/dom";

/**
 * Bridge between legacy HydratedComponentReference and models ComponentReference.
 * Both represent the same runtime shape; the TS incompatibility stems from
 * parallel type definitions (utils/componentSpec vs models/componentSpec).
 */
function toModelComponentRef(
  ref: HydratedComponentReference,
): ComponentReference {
  return ref as ComponentReference;
}

export function useFileDropHandler() {
  const { addTask } = useTaskActions();
  const { addToComponentLibrary } = useComponentLibrary();
  const notify = useToastNotification();

  return async (file: File, spec: ComponentSpec, position: XYPosition) => {
    try {
      const content = await readTextFromFile(file);
      const hydrated = await hydrateComponentReference({ text: content });

      if (!hydrated) {
        notify("Failed to parse component spec from imported content", "error");
        return;
      }

      const result = await addToComponentLibrary(hydrated);
      if (!result) return;

      addTask(spec, toModelComponentRef(result), position);
    } catch (error) {
      console.error("Failed to add imported component to canvas:", error);
      notify("Failed to add component to canvas", "error");
    }
  };
}
