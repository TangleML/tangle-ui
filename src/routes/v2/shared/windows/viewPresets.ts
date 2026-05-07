/** Ordered window ids per dock column; array order is the default stack order (first visit only). */
interface PresetDockAreas {
  left: string[];
  right: string[];
}

export interface ViewPreset {
  label: string;
  description: string;
  visible: Set<string>;
  /** Default dock columns: ids per side, order matters for first-visit layout seeding. */
  dockAreas?: PresetDockAreas;
}

export const DEFAULT_DOCK_AREAS: PresetDockAreas = {
  left: [
    "runs-and-submission",
    "component-library",
    "pipeline-tree",
    "history",
    "debug-panel",
    "recent-runs",
  ],
  right: ["pipeline-details", "context-panel"],
};

/** Target dock side for each window id listed in a preset's `dockAreas`. Right wins if listed on both. */
export function dockSideByWindowId(
  areas: PresetDockAreas,
): Map<string, "left" | "right"> {
  const map = new Map<string, "left" | "right">();
  for (const id of areas.left) {
    map.set(id, "left");
  }
  for (const id of areas.right) {
    map.set(id, "right");
  }
  return map;
}

export const DEFAULT_VIEW_PRESET: ViewPreset = {
  label: "Default",
  description: "Components, Runs & Submissions, Recent Runs, Pipeline Details",
  visible: new Set([
    "runs-and-submission",
    "recent-runs",
    "component-library",
    "pipeline-details",
  ]),
  dockAreas: DEFAULT_DOCK_AREAS,
};

export const VIEW_PRESETS: ViewPreset[] = [
  DEFAULT_VIEW_PRESET,
  {
    label: "All",
    description:
      "All windows visible, including Runs & Submissions and Recent Runs",
    visible: new Set([
      "runs-and-submission",
      "component-library",
      "history",
      "pipeline-tree",
      "pipeline-details",
      "debug-panel",
      "recent-runs",
    ]),
    dockAreas: DEFAULT_DOCK_AREAS,
  },
  {
    label: "Minimal",
    description: "Hide all panels",
    visible: new Set<string>(),
  },
];
