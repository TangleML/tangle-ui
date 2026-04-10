import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import {
  type FavoriteItem,
  type FavoriteType,
  useFavorites,
} from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";

const PAGE_SIZE = 10;

function getFavoriteUrl(item: FavoriteItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  return `${RUNS_BASE_PATH}/${item.id}`;
}

const FavoriteChip = ({
  item,
  onRemove,
}: {
  item: FavoriteItem;
  onRemove: (type: FavoriteType, id: string) => void;
}) => (
  <Link
    to={getFavoriteUrl(item)}
    title={item.name}
    className={cn(
      "group flex items-center gap-1.5 pl-2 pr-1 py-1 border rounded-md min-w-0 no-underline",
      item.type === "pipeline"
        ? "bg-violet-50/50 hover:bg-violet-50 border-violet-100"
        : "bg-emerald-50/50 hover:bg-emerald-50 border-emerald-100",
    )}
  >
    <Icon
      name={item.type === "pipeline" ? "GitBranch" : "Play"}
      size="sm"
      className="shrink-0 text-muted-foreground"
    />
    <Text size="sm" className="truncate">
      {item.name}
    </Text>
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove(item.type, item.id);
      }}
      className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
      aria-label="Remove from favorites"
    >
      <Icon name="X" size="sm" />
    </Button>
  </Link>
);

export const FavoritesSection = () => {
  const { favorites, removeFavorite } = useFavorites();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? favorites.filter(
        (favorite) =>
          favorite.id.toLowerCase().includes(normalizedQuery) ||
          favorite.name.toLowerCase().includes(normalizedQuery),
      )
    : favorites;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paginated = filtered.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

  return (
    <BlockStack gap="2">
      <InlineStack blockAlign="center" gap="1">
        <Icon name="Star" className="text-warning fill-current" />
        <Heading level={2}>Favorites</Heading>
      </InlineStack>

      {favorites.length === 0 ? (
        <Paragraph tone="subdued" size="sm">
          No favorites yet. Star a pipeline or run to pin it here.
        </Paragraph>
      ) : (
        <BlockStack gap="2">
          <div className="relative w-48">
            <Icon
              name="Search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search by name or ID..."
              value={query}
              onChange={(e) => {
                setPage(0);
                setQuery(e.target.value);
              }}
              className="pl-9 pr-8 w-full"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setPage(0);
                  setQuery("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <Icon name="X" size="sm" />
              </Button>
            )}
          </div>

          <InlineStack wrap="wrap" gap="2">
            {paginated.map((item) => (
              <FavoriteChip
                key={`${item.type}-${item.id}`}
                item={item}
                onRemove={removeFavorite}
              />
            ))}
          </InlineStack>

          {totalPages > 1 && (
            <InlineStack blockAlign="center" gap="2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <Icon name="ChevronLeft" />
              </Button>
              <Paragraph tone="subdued" size="sm">
                {safePage + 1} / {totalPages}
              </Paragraph>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
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
};
