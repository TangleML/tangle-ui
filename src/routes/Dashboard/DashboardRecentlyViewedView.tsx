import { Link } from "@tanstack/react-router";
import { GitBranch, Play } from "lucide-react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import {
  type RecentlyViewedItem,
  useRecentlyViewed,
} from "@/hooks/useRecentlyViewed";
import { EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";

function getRecentlyViewedUrl(item: RecentlyViewedItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  if (item.type === "run") return `${RUNS_BASE_PATH}/${item.id}`;
  return "/";
}

function formatRelativeTime(viewedAt: number): string {
  const diff = Date.now() - viewedAt;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const RecentlyViewedCard = ({ item }: { item: RecentlyViewedItem }) => {
  const isPipeline = item.type === "pipeline";

  return (
    <Link
      to={getRecentlyViewedUrl(item)}
      className="flex flex-col gap-2.5 p-3 rounded-lg transition-all shadow-sm hover:shadow-md bg-card border border-border hover:border-foreground/20 no-underline"
    >
      {/* Type pill + timestamp */}
      <InlineStack blockAlign="center" align="space-between">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
            isPipeline
              ? "bg-violet-100 text-violet-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {isPipeline ? (
            <GitBranch className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {isPipeline ? "Pipeline" : "Run"}
        </span>
        <Text size="xs" className="text-muted-foreground">
          {formatRelativeTime(item.viewedAt)}
        </Text>
      </InlineStack>

      {/* Name */}
      <Text size="sm" weight="semibold" className="truncate leading-tight">
        {item.name}
      </Text>

      {/* ID */}
      <Text size="xs" className="truncate text-muted-foreground font-mono">
        {item.id}
      </Text>
    </Link>
  );
};

export function DashboardRecentlyViewedView() {
  const { recentlyViewed } = useRecentlyViewed();

  return (
    <BlockStack gap="4">
      <Text as="h2" size="lg" weight="semibold">
        Recently Viewed
      </Text>

      {recentlyViewed.length === 0 ? (
        <Paragraph tone="subdued" size="sm">
          Nothing viewed yet. Open a pipeline or run to see it here.
        </Paragraph>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {recentlyViewed.map((item) => (
            <RecentlyViewedCard key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </BlockStack>
  );
}
