import { EDITOR_POSITION_ANNOTATION } from "../annotations";
import type { ComponentReference, TaskSpec } from "../componentSpec";

export const generateTaskSpec = (
  componentRef: ComponentReference,
): TaskSpec => {
  return {
    componentRef,
    annotations: {
      [EDITOR_POSITION_ANNOTATION]: JSON.stringify({
        x: 0,
        y: 0,
      }),
    } as { [k: string]: unknown },
  };
};
