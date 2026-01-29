import {
  getAnnotationValue,
  RUN_NAME_TEMPLATE_ANNOTATION,
} from "@/utils/annotations";
import type { ComponentSpec } from "@/utils/componentSpec";

export const getRunNameTemplate = (componentSpec: ComponentSpec) => {
  return getAnnotationValue(
    componentSpec.metadata?.annotations,
    RUN_NAME_TEMPLATE_ANNOTATION,
  );
};
