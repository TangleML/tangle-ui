import type { RecentPipelineLink } from "@/utils/recentPipelines";
import type { RecentRunLink } from "@/utils/recentRuns";

export type RecentLinkItem =
  | (RecentRunLink & { type: "run" })
  | (RecentPipelineLink & { type: "pipeline" });

export type DashboardSectionId = "runs" | "components" | "pipelines";

export function recentItemKey(item: RecentLinkItem): string {
  return `${item.type}-${item.url}`;
}
