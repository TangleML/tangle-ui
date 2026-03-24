import { useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const isPipeline = item.type === "pipeline";

  return (
    <div
      onClick={() => navigate({ to: getRecentlyViewedUrl(item) })}
      className={`flex flex-col gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
        isPipeline
          ? "bg-violet-50/40 hover:bg-violet-50 border-violet-100"
          : "bg-emerald-50/40 hover:bg-emerald-50 border-emerald-100"
      }`}
    >
      {/* Type badge */}
      <InlineStack gap="1" blockAlign="center" align="space-between">
        <InlineStack gap="1" blockAlign="center">
          {isPipeline ? (
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          ) : (
            <Play className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          )}
          <Text
            size="xs"
            weight="semibold"
            className={isPipeline ? "text-violet-600" : "text-emerald-600"}
          >
            {isPipeline ? "Pipeline" : "Run"}
          </Text>
        </InlineStack>
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
    </div>
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
