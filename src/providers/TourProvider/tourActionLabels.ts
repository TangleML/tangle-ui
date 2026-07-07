import type { TourAction } from "./tourActions";

const GENERIC_LABEL = "Complete the highlighted action to continue";

// Labels may embed **bold** spans (rendered by the checklist via renderInline)
// to highlight the contextual target, e.g. the task or folder name.
export function tourActionLabel(step: TourAction): string {
  switch (step.interaction) {
    default:
      return GENERIC_LABEL;
  }
}
