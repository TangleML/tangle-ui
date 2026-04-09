import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import {
  type RecentlyViewedItem,
  useRecentlyViewed,
} from "@/hooks/useRecentlyViewed";
import { APP_ROUTES, EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";
import { formatRelativeTime } from "@/utils/date";

const PAGE_SIZE = 20;

function getRecentlyViewedUrl(item: RecentlyViewedItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  if (item.type === "run") return `${RUNS_BASE_PATH}/${item.id}`;
  return APP_ROUTES.DASHBOARD_COMPONENTS;
}

const RecentlyViewedCard = ({ item }: { item: RecentlyViewedItem }) => {
  const isPipeline = item.type === "pipeline";

  return (
    <Link to={getRecentlyViewedUrl(item)} className="no-underline block">
      <BlockStack
        gap="2"
        className="p-3 rounded-lg transition-all shadow-sm hover:shadow-md bg-card border border-border hover:border-foreground/20"
      >
        {/* Type pill + timestamp */}
        <InlineStack blockAlign="center" align="space-between">
          <InlineStack>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                isPipeline
                  ? "bg-violet-100 text-violet-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              <Icon name={isPipeline ? "GitBranch" : "Play"} size="sm" />
              {isPipeline ? "Pipeline" : "Run"}
            </span>
          </InlineStack>
          <Text size="xs" className="text-muted-foreground">
            {formatRelativeTime(new Date(item.viewedAt))}
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
      </BlockStack>
    </Link>
  );
};

export function DashboardRecentlyViewedView() {
  const { recentlyViewed } = useRecentlyViewed();
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
                <Icon name="ChevronLeft" />
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
                <Icon name="ChevronRight" />
              </Button>
            </InlineStack>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
}
