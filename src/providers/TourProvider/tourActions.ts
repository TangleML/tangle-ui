export type TourInteraction =
  | "undock-window"
  | "redock-window"
  | "select-task"
  | "add-task"
  | "add-input"
  | "add-output"
  | "connect-edge"
  | "expand-folder"
  | "library-search"
  | "set-argument"
  | "navigate-into-subgraph"
  | "navigate-to-root"
  | "unpack-subgraph"
  | "multi-select-tasks"
  | "create-subgraph"
  | "open-secret-dialog"
  | "open-settings-panel"
  | "open-submit-dialog"
  | "assign-secret-argument"
  | "assign-secret-submit";

interface TourActionEdge {
  sourceTaskName: string;
  sourcePortName: string;
  targetTaskName?: string;
  targetPortName?: string;
}

/**
 * The interaction contract for a hands-on tour step: which action the user
 * must perform and the element it targets. Shared between the checklist label
 * (tourActionLabel) and the interaction-detection bridge so the kind union and
 * its target params are defined once.
 */
export interface TourAction {
  interaction?: TourInteraction;
  targetTaskName?: string;
  targetComponentName?: string;
  targetWindowId?: string;
  targetWindowName?: string;
  targetFolderName?: string;
  targetSearchTerm?: string;
  targetArgumentName?: string;
  targetMinCount?: number;
  targetEdge?: TourActionEdge;
}
