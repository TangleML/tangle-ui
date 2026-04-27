import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import {
  type FavoriteItem,
  type FavoriteType,
  useFavorites,
} from "@/hooks/useFavorites";
import { APP_ROUTES } from "@/routes/router";
import { tracking } from "@/utils/tracking";

import { getFavoriteUrl, TypePill } from "./TypePill";

const PREVIEW_COUNT = 5;

const FavoritePreviewRow = ({
  item,
  onRemove,
  trackingId,
}: {
  item: FavoriteItem;
  onRemove: () => void;
  trackingId: string;
}) => (
  <InlineStack gap="2" className="min-w-0 overflow-hidden">
    <Link
      to={getFavoriteUrl(item)}
      {...tracking(trackingId)}
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

interface FavoritesPreviewProps {
  title?: string;
  typeFilter?: FavoriteType;
  emptyMessage?: string;
  hideWhenEmpty?: boolean;
  trackingId?: string;
}

export const FavoritesPreview = ({
  title = "Favorites",
  typeFilter,
  emptyMessage = "No favorites yet. Star a pipeline or run to pin it here.",
  hideWhenEmpty = false,
  trackingId = "homepage.favorites.item",
}: FavoritesPreviewProps) => {
  const { favorites, removeFavorite } = useFavorites();
  const filtered = typeFilter
    ? favorites.filter((f) => f.type === typeFilter)
    : favorites;
  const preview = filtered.slice(0, PREVIEW_COUNT);

  if (hideWhenEmpty && preview.length === 0) return null;

  return (
    <BlockStack gap="4" className="min-w-0">
      <InlineStack gap="3" blockAlign="center" className="min-w-0">
        <Heading level={2}>{title}</Heading>
        <Link
          to={APP_ROUTES.DASHBOARD_FAVORITES}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all →
        </Link>
      </InlineStack>
      <div className="w-full border border-border rounded-lg overflow-hidden divide-y divide-border">
        {preview.length === 0 ? (
          <div className="px-4 py-3">
            <Paragraph tone="subdued" size="sm">
              {emptyMessage}
            </Paragraph>
          </div>
        ) : (
          preview.map((item) => (
            <FavoritePreviewRow
              key={`${item.type}-${item.id}`}
              item={item}
              onRemove={() => removeFavorite(item.type, item.id)}
              trackingId={trackingId}
            />
          ))
        )}
      </div>
    </BlockStack>
  );
};
