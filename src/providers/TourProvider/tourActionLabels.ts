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
    case "expand-folder":
      return step.targetFolderName
        ? `Open the **${step.targetFolderName}** folder`
        : "Open the highlighted folder";
    case "library-search":
      return step.targetSearchTerm
        ? `Search the library for **${step.targetSearchTerm}**`
        : "Search the component library";
    case "add-task":
      return step.targetTaskName
        ? `Add **${step.targetTaskName}** to the canvas`
        : "Add the highlighted component to the canvas";
    case "add-input":
      return "Add an input node to the canvas";
    case "add-output":
      return "Add an output node to the canvas";
    case "connect-edge":
      return "Connect the highlighted ports";
    case "set-argument":
      return step.targetArgumentName
        ? `Set the **${step.targetArgumentName}** value`
        : "Set the highlighted value";
    default:
      return GENERIC_LABEL;
  }
}
