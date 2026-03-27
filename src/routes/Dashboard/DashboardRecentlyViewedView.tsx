import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, GitBranch, Play } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import {
  type RecentlyViewedItem,
  useRecentlyViewed,
} from "@/hooks/useRecentlyViewed";
import { EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";

const PAGE_SIZE = 20;

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
  const { recentlyViewed: allRecentlyViewed } = useRecentlyViewed();
  const recentlyViewed = allRecentlyViewed.filter(
    (item) => item.type !== "component",
  );
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(recentlyViewed.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paginated = recentlyViewed.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

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
        <BlockStack gap="4">
          <div className="grid grid-cols-4 gap-3">
            {paginated.map((item) => (
              <RecentlyViewedCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>

          {totalPages > 1 && (
            <InlineStack blockAlign="center" gap="2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Text size="sm" className="text-muted-foreground">
                {safePage + 1} / {totalPages}
              </Text>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </InlineStack>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
}
