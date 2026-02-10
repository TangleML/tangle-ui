import { getRecentItems, recordRecentItem } from "@/utils/recentItems";

export interface RecentPipelineLink {
  title: string;
  url: string;
}

export function recordRecentPipeline(title: string, url: string): void {
  recordRecentItem({
    title,
    type: "pipeline",
    url,
  });
}

/** Returns recently opened pipelines, most recent first. */
export function getRecentPipelines(): RecentPipelineLink[] {
  return getRecentItems("pipeline").map(({ title, url }) => ({ title, url }));
}
