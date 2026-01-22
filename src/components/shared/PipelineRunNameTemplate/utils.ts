import { getAnnotationValue, setAnnotation } from "@/utils/annotations";
import type { ComponentSpec } from "@/utils/componentSpec";

export const getRunNameTemplate = (componentSpec: ComponentSpec) => {
  return getAnnotationValue(
    componentSpec.metadata?.annotations,
    RUN_NAME_TEMPLATE_ANNOTATION,
  );
};

export const setRunNameTemplate = (
  componentSpec: ComponentSpec,
  runNameTemplate: string | undefined,
) => {
  return {
    ...componentSpec,
    metadata: {
      ...componentSpec.metadata,
      annotations: setAnnotation(
        componentSpec.metadata?.annotations,
        RUN_NAME_TEMPLATE_ANNOTATION,
        runNameTemplate,
      ),
    },
  };
};

const RUN_NAME_TEMPLATE_ANNOTATION = "run-name-template";
