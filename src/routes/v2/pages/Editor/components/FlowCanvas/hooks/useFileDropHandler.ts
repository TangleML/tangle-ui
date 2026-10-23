import type { XYPosition } from "@xyflow/react";

import useToastNotification from "@/hooks/useToastNotification";
import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import { componentMetadata } from "@/utils/componentTracking";
import { readTextFromFile } from "@/utils/dom";

import { useValidateComponentDrop } from "./useValidateComponentDrop";

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
  const { track } = useAnalytics();
  const notify = useToastNotification();
  const { navigation } = useSharedStores();
  const validateComponentDrop = useValidateComponentDrop();

  return async (file: File, spec: ComponentSpec, position: XYPosition) => {
    try {
      const content = await readTextFromFile(file);
      const hydrated = await validateComponentDrop({ text: content });

      if (!hydrated || navigation.activeSpec !== spec) return;

      const result = await addToComponentLibrary(
        hydrated,
        "canvas_file_drop_v2",
      );
      if (!result || navigation.activeSpec !== spec) return;

      addTask(spec, toModelComponentRef(result), position);

      track("pipeline_editor.component.dropped", {
        ...componentMetadata(result, "file"),
        drop_kind: "file_import",
        pipeline_id: spec.name,
      });
    } catch (error) {
      console.error("Failed to add imported component to canvas:", error);
      notify("Failed to add component to canvas", "error");
    }
  };
}
