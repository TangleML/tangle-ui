import { getRecentItems, recordRecentItem } from "@/utils/recentItems";

export interface RecentRunLink {
  title: string;
  url: string;
}

export function recordRecentRun(title: string, url: string): void {
  recordRecentItem({
    title,
    type: "run",
    url,
  });
}

/** Returns recently viewed runs, most recent first. */
export function getRecentRuns(): RecentRunLink[] {
  return getRecentItems("run").map(({ title, url }) => ({ title, url }));
}
