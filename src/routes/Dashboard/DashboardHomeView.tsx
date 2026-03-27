// TODO: Remove fake announcement data before shipping
if (!window.__TANGLE_ANNOUNCEMENTS__) {
  window.__TANGLE_ANNOUNCEMENTS__ = [
    {
      id: "dashboard-beta-welcome",
      title: "Welcome to the new Dashboard (Beta)",
      body: "We're rolling out new features — favorites, recently viewed, and more. Expect changes as we iterate.",
      variant: "info",
      dismissible: true,
    },
  ];
}

import { Link } from "@tanstack/react-router";
import { GitBranch, Play } from "lucide-react";

import { RunSection } from "@/components/Home/RunSection/RunSection";
import { AnnouncementBanners } from "@/components/shared/AnnouncementBanners";
import { Icon } from "@/components/ui/icon";
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
import { APP_ROUTES, EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";

const PREVIEW_COUNT = 5;

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

function getRecentlyViewedUrl(item: RecentlyViewedItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  if (item.type === "run") return `${RUNS_BASE_PATH}/${item.id}`;
  return "/";
}

function getFavoriteUrl(item: FavoriteItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  return `${RUNS_BASE_PATH}/${item.id}`;
}

const TypePill = ({ type }: { type: "pipeline" | "run" | "component" }) => (
  <span
    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
      type === "pipeline"
        ? "bg-violet-100 text-violet-700"
        : "bg-emerald-100 text-emerald-700"
    }`}
  >
    {type === "pipeline" ? (
      <GitBranch className="h-3 w-3" />
    ) : (
      <Play className="h-3 w-3" />
    )}
    {type === "pipeline" ? "Pipeline" : type === "run" ? "Run" : "Component"}
  </span>
);

const SectionHeader = ({
  title,
  viewAllTo,
  viewAllLabel = "View all",
}: {
  title: string;
  viewAllTo: string;
  viewAllLabel?: string;
}) => (
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

// ─── Favorites ─────────────────────────────────────────────────────────────────

const FavoritesPreview = () => {
  const { favorites, removeFavorite } = useFavorites();
  const preview = favorites.slice(-PREVIEW_COUNT).reverse();

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <SectionHeader
        title="Favorites"
        viewAllTo={APP_ROUTES.DASHBOARD_FAVORITES}
      />
      <div className="border border-border rounded-lg overflow-hidden">
        {preview.length === 0 ? (
          <div className="px-4 py-3">
            <Paragraph tone="subdued" size="sm">
              No favorites yet. Star a pipeline or run to pin it here.
            </Paragraph>
          </div>
        ) : (
          preview.map((item, i) => (
            <Link
              key={`${item.type}-${item.id}`}
              to={getFavoriteUrl(item)}
              className={`group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 no-underline ${
                i < preview.length - 1 ? "border-b border-border" : ""
              }`}
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
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeFavorite(item.type, item.id);
                }}
                className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Remove from favorites"
              >
                <Icon name="X" size="sm" />
              </button>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Recently Viewed ───────────────────────────────────────────────────────────

const RecentlyViewedPreview = () => {
  const { recentlyViewed } = useRecentlyViewed();
  const preview = recentlyViewed.slice(0, PREVIEW_COUNT);

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <SectionHeader
        title="Recently Viewed"
        viewAllTo={APP_ROUTES.DASHBOARD_RECENTLY_VIEWED}
      />
      <div className="border border-border rounded-lg overflow-hidden">
        {preview.length === 0 ? (
          <div className="px-4 py-3">
            <Paragraph tone="subdued" size="sm">
              Nothing viewed yet. Open a pipeline or run to see it here.
            </Paragraph>
          </div>
        ) : (
          preview.map((item, i) => (
            <Link
              key={`${item.type}-${item.id}`}
              to={getRecentlyViewedUrl(item)}
              className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 no-underline ${
                i < preview.length - 1 ? "border-b border-border" : ""
              }`}
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
                {formatRelativeTime(item.viewedAt)}
              </Text>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

// ─── My Dashboard ──────────────────────────────────────────────────────────────

export function DashboardHomeView() {
  return (
    <BlockStack gap="6">
      <AnnouncementBanners />

      {/* Favorites + Recently Viewed + (future) side by side */}
      <div className="grid grid-cols-3 gap-6">
        <FavoritesPreview />
        <RecentlyViewedPreview />
        <div />
      </div>

      {/* My Runs — full table with created_by:me filter */}
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
