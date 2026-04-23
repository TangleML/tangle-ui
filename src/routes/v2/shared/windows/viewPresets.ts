export interface ViewPreset {
  label: string;
  description: string;
  visible: Set<string>;
  /** Default dock positions to restore when applying this preset. */
  dockPositions?: Record<string, "left" | "right">;
}

const DEFAULT_DOCK_POSITIONS: Record<string, "left" | "right"> = {
  "component-library": "left",
  "pipeline-tree": "left",
  history: "left",
  "debug-panel": "left",
  "pipeline-details": "right",
  "recent-runs": "left",
  "context-panel": "right",
};

export const DEFAULT_VIEW_PRESET: ViewPreset = {
  label: "Default",
  description: "Components, Recent Runs, Pipeline Details",
  visible: new Set(["component-library", "recent-runs", "pipeline-details"]),
  dockPositions: DEFAULT_DOCK_POSITIONS,
};

export const VIEW_PRESETS: ViewPreset[] = [
  DEFAULT_VIEW_PRESET,
  {
    label: "All",
    description: "All windows visible",
    visible: new Set([
      "component-library",
      "history",
      "pipeline-tree",
      "pipeline-details",
      "debug-panel",
      "recent-runs",
    ]),
    dockPositions: DEFAULT_DOCK_POSITIONS,
  },
  {
    label: "Minimal",
    description: "Hide all panels",
    visible: new Set<string>(),
  },
];
