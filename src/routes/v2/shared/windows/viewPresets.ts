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

const COMPONENT_SEARCH_WINDOW_ID = "component-search-v2";
const COMPONENT_LIBRARY_WINDOW_ID = "component-library";

export const DEFAULT_DOCK_AREAS: PresetDockAreas = {
  left: [
    "tip-of-the-day",
    "runs-and-submission",
    COMPONENT_SEARCH_WINDOW_ID,
    COMPONENT_LIBRARY_WINDOW_ID,
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
    "component-search-v2",
    "component-library",
    "pipeline-details",
    "tip-of-the-day",
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
      COMPONENT_SEARCH_WINDOW_ID,
      COMPONENT_LIBRARY_WINDOW_ID,
      "history",
      "pipeline-tree",
      "pipeline-details",
      "debug-panel",
      "recent-runs",
      "tip-of-the-day",
    ]),
    dockAreas: DEFAULT_DOCK_AREAS,
  },
  {
    label: "Minimal",
    description: "Hide all panels",
    visible: new Set<string>(),
  },
];

function filterWindowIdsForComponentSearchMode(
  ids: string[],
  componentSearchV2Enabled: boolean,
): string[] {
  const hiddenWindowId = componentSearchV2Enabled
    ? COMPONENT_LIBRARY_WINDOW_ID
    : COMPONENT_SEARCH_WINDOW_ID;
  return ids.filter((id) => id !== hiddenWindowId);
}

export function viewPresetForComponentSearchMode(
  preset: ViewPreset,
  componentSearchV2Enabled: boolean,
): ViewPreset {
  const visible = new Set(
    filterWindowIdsForComponentSearchMode(
      [...preset.visible],
      componentSearchV2Enabled,
    ),
  );

  const dockAreas = preset.dockAreas
    ? {
        left: filterWindowIdsForComponentSearchMode(
          preset.dockAreas.left,
          componentSearchV2Enabled,
        ),
        right: filterWindowIdsForComponentSearchMode(
          preset.dockAreas.right,
          componentSearchV2Enabled,
        ),
      }
    : undefined;

  return { ...preset, visible, dockAreas };
}

export function viewPresetsForComponentSearchMode(
  componentSearchV2Enabled: boolean,
): ViewPreset[] {
  return VIEW_PRESETS.map((preset) =>
    viewPresetForComponentSearchMode(preset, componentSearchV2Enabled),
  );
}
