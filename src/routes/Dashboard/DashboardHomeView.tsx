import { Link } from "@tanstack/react-router";

import { RunSection } from "@/components/Home/RunSection/RunSection";
import { AnnouncementBanners } from "@/components/shared/AnnouncementBanners";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Paragraph, Text } from "@/components/ui/typography";
import { type FavoriteItem, useFavorites } from "@/hooks/useFavorites";
import {
  type RecentlyViewedItem,
  useRecentlyViewed,
} from "@/hooks/useRecentlyViewed";
import { cn } from "@/lib/utils";
import { APP_ROUTES, EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";
import { formatRelativeTime } from "@/utils/date";

const PREVIEW_COUNT = 5;

function getRecentlyViewedUrl(item: RecentlyViewedItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  if (item.type === "run") return `${RUNS_BASE_PATH}/${item.id}`;
  return APP_ROUTES.DASHBOARD_COMPONENTS;
}

function getFavoriteUrl(item: FavoriteItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  return `${RUNS_BASE_PATH}/${item.id}`;
}

type ItemType = "pipeline" | "run" | "component";

const TYPE_CONFIG: Record<
  ItemType,
  { className: string; icon: IconName; label: string }
> = {
  pipeline: {
    className: "bg-violet-100 text-violet-700",
    icon: "GitBranch",
    label: "Pipeline",
  },
  run: {
    className: "bg-emerald-100 text-emerald-700",
    icon: "Play",
    label: "Run",
  },
  component: {
    className: "bg-blue-100 text-blue-700",
    icon: "Package",
    label: "Component",
  },
};

const TypePill = ({ type }: { type: ItemType }) => {
  const config = TYPE_CONFIG[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold shrink-0",
        config.className,
      )}
    >
      <Icon name={config.icon} size="sm" />
      {config.label}
    </span>
  );
};

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
  <InlineStack gap="3" blockAlign="center">
    <Text as="h2" size="lg" weight="semibold">
      {title}
    </Text>
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
  <Link
    to={getFavoriteUrl(item)}
    className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 no-underline"
  >
    <TypePill type={item.type} />
    <Tooltip>
      <TooltipTrigger asChild>
        <Text size="sm" className="flex-1 min-w-0 truncate">
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
);

const RecentlyViewedPreviewRow = ({ item }: { item: RecentlyViewedItem }) => (
  <Link
    to={getRecentlyViewedUrl(item)}
    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 no-underline"
  >
    <TypePill type={item.type} />
    <Tooltip>
      <TooltipTrigger asChild>
        <Text size="sm" className="flex-1 min-w-0 truncate">
          {item.name}
        </Text>
      </TooltipTrigger>
      <TooltipContent>{item.name}</TooltipContent>
    </Tooltip>
    <Text size="xs" className="text-muted-foreground shrink-0">
      {formatRelativeTime(new Date(item.viewedAt))}
    </Text>
  </Link>
);

const FavoritesPreview = () => {
  const { favorites, removeFavorite } = useFavorites();
  const preview = favorites.slice(0, PREVIEW_COUNT);

  return (
    <BlockStack gap="3" className="min-w-0">
      <SectionHeader
        title="Favorites"
        viewAllTo={APP_ROUTES.DASHBOARD_FAVORITES}
      />
      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
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
  const preview = recentlyViewed.slice(0, PREVIEW_COUNT);

  return (
    <BlockStack gap="3" className="min-w-0">
      <SectionHeader
        title="Recently Viewed"
        viewAllTo={APP_ROUTES.DASHBOARD_RECENTLY_VIEWED}
      />
      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
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

export function DashboardHomeView() {
  return (
    <BlockStack gap="6">
      <AnnouncementBanners />

      <div className="grid grid-cols-3 gap-6">
        <FavoritesPreview />
        <RecentlyViewedPreview />
        <div />
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
