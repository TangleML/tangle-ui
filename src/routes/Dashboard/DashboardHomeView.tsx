import { Link } from "@tanstack/react-router";

import { RunSection } from "@/components/Home/RunSection/RunSection";
import { AnnouncementBanners } from "@/components/shared/AnnouncementBanners";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { type FavoriteItem, useFavorites } from "@/hooks/useFavorites";
import {
  type RecentlyViewedItem,
  useRecentlyViewed,
} from "@/hooks/useRecentlyViewed";
import { APP_ROUTES } from "@/routes/router";
import { formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { getFavoriteUrl, getRecentlyViewedUrl, TypePill } from "./TypePill";

const PREVIEW_COUNT = 5;

interface SectionHeaderProps {
  title: string;
  viewAllTo: string;
  viewAllLabel?: string;
}

const SectionHeader = ({
  title,
  viewAllTo,
  viewAllLabel = "View all",
}: SectionHeaderProps) => (
  <InlineStack gap="3" blockAlign="center" className="min-w-0">
    <Heading level={2}>{title}</Heading>
    <Link
      to={viewAllTo}
      className="text-xs text-muted-foreground hover:text-foreground"
    >
      {viewAllLabel} →
    </Link>
  </InlineStack>
);

const FavoritePreviewRow = ({
  item,
  onRemove,
}: {
  item: FavoriteItem;
  onRemove: () => void;
}) => (
  <InlineStack gap="2" className="min-w-0 overflow-hidden">
    <Link
      to={getFavoriteUrl(item)}
      {...tracking("homepage.favorites.item")}
      className="group flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/50 no-underline"
    >
      <TypePill type={item.type} />
      <Tooltip>
        <TooltipTrigger className="flex-1 min-w-0 overflow-hidden text-left">
          <Text size="sm" className="truncate block">
            {item.name}
          </Text>
        </TooltipTrigger>
        <TooltipContent>{item.name}</TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 size-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
        aria-label="Remove from favorites"
      >
        <Icon name="X" size="sm" />
      </Button>
    </Link>
  </InlineStack>
);

const RecentlyViewedPreviewRow = ({ item }: { item: RecentlyViewedItem }) => (
  <InlineStack gap="2" className="min-w-0 overflow-hidden">
    <Link
      to={getRecentlyViewedUrl(item)}
      {...tracking("homepage.recently_viewed_pipelines.item")}
      className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/50 no-underline"
    >
      <TypePill type={item.type} />
      <Tooltip>
        <TooltipTrigger className="flex-1 min-w-0 overflow-hidden text-left">
          <Text size="sm" className="truncate block">
            {item.name}
          </Text>
        </TooltipTrigger>
        <TooltipContent>{item.name}</TooltipContent>
      </Tooltip>
      <Text size="xs" className="text-muted-foreground shrink-0">
        {formatRelativeTime(new Date(item.viewedAt))}
      </Text>
    </Link>
  </InlineStack>
);

const FavoritesPreview = () => {
  const { favorites, removeFavorite } = useFavorites();
  const preview = favorites.slice(0, PREVIEW_COUNT);

  return (
    <BlockStack gap="4" className="min-w-0">
      <SectionHeader
        title="Favorites"
        viewAllTo={APP_ROUTES.DASHBOARD_FAVORITES}
      />
      <div className="w-full border border-border rounded-lg overflow-hidden divide-y divide-border">
        {preview.length === 0 ? (
          <div className="px-4 py-3">
            <Paragraph tone="subdued" size="sm">
              No favorites yet. Star a pipeline or run to pin it here.
            </Paragraph>
          </div>
        ) : (
          preview.map((item) => (
            <FavoritePreviewRow
              key={`${item.type}-${item.id}`}
              item={item}
              onRemove={() => removeFavorite(item.type, item.id)}
            />
          ))
        )}
      </div>
    </BlockStack>
  );
};

const RecentlyViewedPreview = () => {
  const { recentlyViewed } = useRecentlyViewed();
  const preview = recentlyViewed
    .filter((item) => item.type !== "component")
    .slice(0, PREVIEW_COUNT);

  return (
    <BlockStack gap="4" className="min-w-0">
      <SectionHeader
        title="Recently Viewed"
        viewAllTo={APP_ROUTES.DASHBOARD_RECENTLY_VIEWED}
      />
      <div className="w-full border border-border rounded-lg overflow-hidden divide-y divide-border">
        {preview.length === 0 ? (
          <div className="px-4 py-3">
            <Paragraph tone="subdued" size="sm">
              Nothing viewed yet. Open a pipeline or run to see it here.
            </Paragraph>
          </div>
        ) : (
          preview.map((item) => (
            <RecentlyViewedPreviewRow
              key={`${item.type}-${item.id}`}
              item={item}
            />
          ))
        )}
      </div>
    </BlockStack>
  );
};

const RecentComponentPreviewRow = ({ item }: { item: RecentlyViewedItem }) => (
  <InlineStack gap="2" className="min-w-0 overflow-hidden">
    <Link
      to={APP_ROUTES.DASHBOARD_COMPONENTS}
      search={{ component: item.id }}
      {...tracking("homepage.recently_used_components.item")}
      className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/50 no-underline"
    >
      <TypePill type="component" />
      <Tooltip>
        <TooltipTrigger className="flex-1 min-w-0 overflow-hidden text-left">
          <Text size="sm" className="truncate block">
            {item.name}
          </Text>
        </TooltipTrigger>
        <TooltipContent>{item.name}</TooltipContent>
      </Tooltip>
      <Text size="xs" className="text-muted-foreground shrink-0">
        {formatRelativeTime(new Date(item.viewedAt))}
      </Text>
    </Link>
  </InlineStack>
);

const RecentComponentsPreview = () => {
  const { recentlyViewed } = useRecentlyViewed();
  const preview = recentlyViewed
    .filter((item) => item.type === "component")
    .slice(0, PREVIEW_COUNT);

  return (
    <BlockStack gap="4" className="min-w-0">
      <SectionHeader
        title="Recently Used Components"
        viewAllTo={APP_ROUTES.DASHBOARD_COMPONENTS}
        viewAllLabel="View all"
      />
      <div className="w-full border border-border rounded-lg overflow-hidden divide-y divide-border">
        {preview.length === 0 ? (
          <div className="px-4 py-3">
            <Paragraph tone="subdued" size="sm">
              No components viewed yet. Open a component to see it here.
            </Paragraph>
          </div>
        ) : (
          preview.map((item) => (
            <RecentComponentPreviewRow key={item.id} item={item} />
          ))
        )}
      </div>
    </BlockStack>
  );
};

export function DashboardHomeView() {
  return (
    <BlockStack gap="6">
      <AnnouncementBanners />

      <div className="grid grid-cols-3 gap-6 overflow-hidden">
        <FavoritesPreview />
        <RecentlyViewedPreview />
        <RecentComponentsPreview />
      </div>

      <BlockStack gap="3">
        <SectionHeader
          title="My Runs"
          viewAllTo={APP_ROUTES.DASHBOARD_RUNS}
          viewAllLabel="View all runs"
        />
        {/*
          Fetching 10 records because the API does not yet support a custom page_size.
          Once TangleML/tangle#188 lands, reduce this to match the visible row count.
          Tracked in TangleML/tangle-ui#2016.
        */}
        <RunSection hideFilters forcedFilter="created_by:me" maxItems={10} />
      </BlockStack>
    </BlockStack>
  );
}
