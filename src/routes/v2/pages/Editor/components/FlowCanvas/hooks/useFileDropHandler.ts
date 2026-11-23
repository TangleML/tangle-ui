import type { XYPosition } from "@xyflow/react";

import {
  type PickOutcome,
  yamlErrorOutcome,
} from "@/components/shared/FilePicker";
import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import { componentMetadata } from "@/utils/componentTracking";
import { componentSpecFromYaml } from "@/utils/yaml";

import {
  type ComponentDropValidationError,
  useValidateComponentDrop,
} from "./useValidateComponentDrop";

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

const PIPELINE_CHANGED_OUTCOME: PickOutcome = {
  status: "error",
  message: "The pipeline changed before the component was added.",
};

export function useFileDropHandler(spec: ComponentSpec | null) {
  const { addTask } = useTaskActions();
  const { addToComponentLibrary } = useComponentLibrary();
  const { track } = useAnalytics();
  const { navigation } = useSharedStores();
  const validateComponentDrop = useValidateComponentDrop();

  return async ({
    text,
    position,
  }: {
    file: File;
    text: string;
    position: XYPosition;
  }): Promise<PickOutcome> => {
    if (!spec) {
      return { status: "error", message: "No pipeline is open." };
    }
    try {
      // validateComponentDrop swallows parse errors, so parse first to surface the reason.
      componentSpecFromYaml(text);
    } catch (error) {
      return yamlErrorOutcome(error, "Failed to add component to canvas");
    }
    try {
      let validationErrors: string[] | undefined;
      const hydrated = await validateComponentDrop(
        { text },
        {
          onError: ({ errors }: ComponentDropValidationError) => {
            validationErrors = errors;
          },
        },
      );

      if (!hydrated) {
        return {
          status: "error",
          message:
            validationErrors?.join("\n") ??
            "The component was not added to the canvas.",
        };
      }
      if (navigation.activeSpec !== spec) return PIPELINE_CHANGED_OUTCOME;

      const result = await addToComponentLibrary(
        hydrated,
        "canvas_file_drop_v2",
      );
      if (!result) {
        return {
          status: "error",
          title: "Import cancelled",
          message: "The component was not added to your library.",
        };
      }
      if (navigation.activeSpec !== spec) return PIPELINE_CHANGED_OUTCOME;

      addTask(spec, toModelComponentRef(result), position);

      track("pipeline_editor.component.dropped", {
        ...componentMetadata(result, "file"),
        drop_kind: "file_import",
        pipeline_id: spec.name,
      });

      return {
        status: "success",
        message: `${result.name} added to the canvas`,
      };
    } catch (error) {
      console.error("Failed to add imported component to canvas:", error);
      return yamlErrorOutcome(error, "Failed to add component to canvas");
    }
  };
}
