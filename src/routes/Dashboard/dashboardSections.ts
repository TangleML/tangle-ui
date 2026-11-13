import { APP_ROUTES } from "@/routes/appRoutes";
import { getStorage } from "@/utils/typedStorage";
import { isRecord } from "@/utils/typeGuards";

export const SECTION_TYPES = {
  favorites: { title: "Favorites", to: APP_ROUTES.DASHBOARD_FAVORITES },
  recent: {
    title: "Recently Viewed",
    to: APP_ROUTES.DASHBOARD_RECENTLY_VIEWED,
  },
  used: { title: "Recently Used", to: undefined },
  "recent-components": {
    title: "Recently Used Components",
    to: APP_ROUTES.DASHBOARD_COMPONENTS,
  },
  projects: { title: "My Projects", to: APP_ROUTES.PROJECTS },
  runs: { title: "My Runs", to: APP_ROUTES.DASHBOARD_RUNS },
  pipelines: { title: "My Pipelines", to: APP_ROUTES.DASHBOARD_PIPELINES },
} as const;

export type SectionType = keyof typeof SECTION_TYPES;
type SectionWidth = 1 | 2 | 3;
export interface DashboardSection {
  id: string;
  type: SectionType | null;
  width: SectionWidth;
}

export const DEFAULT_SECTIONS: DashboardSection[] = [
  { id: "favorites", type: "favorites", width: 1 },
  { id: "recent", type: "recent", width: 1 },
  { id: "recent-components", type: "recent-components", width: 1 },
  { id: "projects", type: "projects", width: 2 },
  { id: "pipelines", type: "pipelines", width: 1 },
  { id: "runs", type: "runs", width: 3 },
];

const STORAGE_KEY = "Home/dashboard-layout-v1";
const storage = getStorage<
  typeof STORAGE_KEY,
  Record<typeof STORAGE_KEY, DashboardSection[]>
>();

export function readDashboardLayout(): DashboardSection[] {
  const saved: unknown = storage.getItem(STORAGE_KEY);
  if (!Array.isArray(saved)) return DEFAULT_SECTIONS;
  // Keep custom layouts when retiring the catalog section.
  const sections = saved.filter(
    (section) => !isRecord(section) || section.type !== "components",
  );
  const ids = new Set<string>();
  const valid = sections.every((section) => {
    if (
      !isRecord(section) ||
      typeof section.id !== "string" ||
      !section.id ||
      ids.has(section.id)
    )
      return false;
    ids.add(section.id);
    return (
      typeof section.type === "string" &&
      Object.hasOwn(SECTION_TYPES, section.type) &&
      [1, 2, 3].includes(section.width as number)
    );
  });
  // An intentionally blank dashboard is a valid saved layout.
  return valid ? sections : DEFAULT_SECTIONS;
}

export function saveDashboardLayout(sections: DashboardSection[]) {
  storage.setItem(
    STORAGE_KEY,
    sections.filter((section) => section.type !== null),
  );
}

export function moveSection(
  sections: DashboardSection[],
  source: string,
  target: string,
) {
  const from = sections.findIndex((section) => section.id === source);
  const to = sections.findIndex((section) => section.id === target);
  if (from < 0 || to < 0 || from === to) return sections;
  const next = [...sections];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/** Keep configured rows intact before empty widgets are hidden. */
export function groupDashboardSections(
  sections: DashboardSection[],
): DashboardSection[][] {
  const rows: DashboardSection[][] = [];
  let usedWidth = 0;
  for (const section of sections) {
    if (rows.length === 0 || usedWidth + section.width > 3) {
      rows.push([]);
      usedWidth = 0;
    }
    rows[rows.length - 1].push(section);
    usedWidth += section.width;
  }
  return rows;
}
