import type { TourAction } from "./tourActions";

const GENERIC_LABEL = "Complete the highlighted action to continue";

// Labels may embed **bold** spans (rendered by the checklist via renderInline)
// to highlight the contextual target, e.g. the task or folder name.
export function tourActionLabel(step: TourAction): string {
  switch (step.interaction) {
    case "select-task":
      return step.targetTaskName
        ? `Select the **${step.targetTaskName}** task`
        : "Select the highlighted task";
    case "undock-window":
      return step.targetWindowName
        ? `Drag the **${step.targetWindowName}** panel out of its dock`
        : "Drag the panel out of its dock";
    case "redock-window":
      return step.targetWindowName
        ? `Dock the **${step.targetWindowName}** panel back into place`
        : "Dock the panel back into place";
    default:
      return GENERIC_LABEL;
  }
}
