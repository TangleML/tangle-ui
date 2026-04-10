import { Link } from "@tanstack/react-router";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import {
  type RecentlyViewedItem,
  useRecentlyViewed,
} from "@/hooks/useRecentlyViewed";
import { APP_ROUTES, EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";
import { formatRelativeTime } from "@/utils/date";

function getRecentlyViewedUrl(item: RecentlyViewedItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  if (item.type === "run") return `${RUNS_BASE_PATH}/${item.id}`;
  return APP_ROUTES.DASHBOARD_COMPONENTS;
}

const RecentlyViewedCard = ({ item }: { item: RecentlyViewedItem }) => {
  const isPipeline = item.type === "pipeline";

  return (
    <Link
      to={getRecentlyViewedUrl(item)}
      className={`flex flex-col gap-2 p-3 border rounded-lg transition-colors no-underline ${
        isPipeline
          ? "bg-violet-50/40 hover:bg-violet-50 border-violet-100"
          : "bg-emerald-50/40 hover:bg-emerald-50 border-emerald-100"
      }`}
    >
      {/* Type badge */}
      <InlineStack gap="1" blockAlign="center" align="space-between">
        <InlineStack gap="1" blockAlign="center">
          <Icon
            name={isPipeline ? "GitBranch" : "Play"}
            size="sm"
            className={`shrink-0 ${isPipeline ? "text-violet-500" : "text-emerald-500"}`}
          />
          <Text
            size="xs"
            weight="semibold"
            className={isPipeline ? "text-violet-600" : "text-emerald-600"}
          >
            {isPipeline ? "Pipeline" : "Run"}
          </Text>
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
