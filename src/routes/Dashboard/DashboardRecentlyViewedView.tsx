import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { type RecentItem, useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { APP_ROUTES } from "@/routes/router";
import { formatRelativeTime } from "@/utils/date";

import { getRecentlyViewedUrl, TypePill } from "./TypePill";

const PAGE_SIZE = 20;

const RecentlyViewedCardBody = ({ item }: { item: RecentItem }) => (
  <BlockStack
    gap="2"
    className="p-3 rounded-lg transition-all shadow-sm hover:shadow-md bg-card border border-border hover:border-foreground/20 overflow-hidden"
  >
    <InlineStack blockAlign="center" align="space-between" gap="2">
      <TypePill type={item.type} />
      <Text size="xs" className="text-muted-foreground">
        {formatRelativeTime(new Date(item.timestamp))}
      </Text>
    </InlineStack>

    <Text size="sm" weight="semibold" className="truncate leading-tight">
      {item.name}
    </Text>

    <Text
      size="xs"
      className="truncate text-muted-foreground font-mono max-w-full"
    >
      {item.id}
    </Text>
  </BlockStack>
);

const RecentlyViewedCard = ({ item }: { item: RecentItem }) => {
  if (item.type === "component") {
    return (
      <Link
        to={APP_ROUTES.DASHBOARD_COMPONENTS}
        search={{ component: item.id }}
        className="no-underline block"
      >
        <RecentlyViewedCardBody item={item} />
      </Link>
    );
  }

  return (
    <Link to={getRecentlyViewedUrl(item)} className="no-underline block">
      <RecentlyViewedCardBody item={item} />
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
      <Heading level={2}>Recently Viewed</Heading>

      {recentlyViewed.length === 0 ? (
        <Paragraph tone="subdued" size="sm">
          Nothing viewed yet. Open a pipeline, run, component, or tour to see it
          here.
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
