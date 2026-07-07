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
    case "navigate-into-subgraph":
      return step.targetTaskName
        ? `Open the **${step.targetTaskName}** subgraph`
        : "Open the highlighted subgraph";
    case "navigate-to-root":
      return "Return to the top level";
    case "unpack-subgraph":
      return "Unpack the subgraph";
    case "multi-select-tasks":
      return `Select **${step.targetMinCount ?? 2}** tasks`;
    case "create-subgraph":
      return "Create a subgraph from the selected tasks";
    case "open-secret-dialog":
      return "Open the secret picker from the ⚡ menu";
    case "open-settings-panel":
      return "Open Settings to manage your secrets";
    case "open-submit-dialog":
      return "Open the run arguments dialog";
    case "assign-secret-argument":
      return step.targetArgumentName
        ? `Assign a secret to the **${step.targetArgumentName}** argument`
        : "Assign a secret to the argument";
    case "assign-secret-submit":
      return step.targetArgumentName
        ? `Bind a secret to **${step.targetArgumentName}** at submit`
        : "Bind a secret at submit time";
    default:
      return GENERIC_LABEL;
  }
}
