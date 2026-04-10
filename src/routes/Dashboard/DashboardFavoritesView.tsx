import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import { type FavoriteItem, useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";

const PAGE_SIZE = 20;

function getFavoriteUrl(item: FavoriteItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  return `${RUNS_BASE_PATH}/${item.id}`;
}

const FavoriteCard = ({ item }: { item: FavoriteItem }) => {
  const { removeFavorite } = useFavorites();

  const isPipeline = item.type === "pipeline";

  return (
    <Link
      to={getFavoriteUrl(item)}
      className="group relative flex flex-col gap-2.5 p-3 rounded-lg transition-all shadow-sm hover:shadow-md bg-card border border-border hover:border-foreground/20 no-underline overflow-hidden"
    >
      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          removeFavorite(item.type, item.id);
        }}
        className="absolute top-2 right-2 size-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
        aria-label="Remove from favorites"
      >
        <Icon name="X" size="sm" />
      </Button>

      {/* Type pill */}
      <InlineStack>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold",
            isPipeline
              ? "bg-violet-100 text-violet-700"
              : "bg-emerald-100 text-emerald-700",
          )}
        >
          <Icon name={isPipeline ? "GitBranch" : "Play"} size="sm" />
          {isPipeline ? "Pipeline" : "Run"}
        </span>
      </InlineStack>

      {/* Name */}
      <Text size="sm" weight="semibold" className="truncate pr-4 leading-tight">
        {item.name}
      </Text>

      {/* ID */}
      <Text size="xs" tone="subdued" font="mono" className="truncate">
        {item.id}
      </Text>
    </Link>
  );
};

interface FavoritesSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
}

const FavoritesSearchBar = ({
  query,
  onQueryChange,
}: FavoritesSearchBarProps) => (
  <div className="relative w-64">
    <Icon
      name="Search"
      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
    />
    <Input
      placeholder="Search by name or ID..."
      value={query}
      onChange={(e) => onQueryChange(e.target.value)}
      className="pl-9 pr-8"
    />
    {query && (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onQueryChange("")}
        className="absolute right-2 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
        aria-label="Clear search"
      >
        <Icon name="X" size="sm" />
      </Button>
    )}
  </div>
);

export function DashboardFavoritesView() {
  const { favorites } = useFavorites();
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

  function handleQueryChange(value: string) {
    setPage(0);
    setQuery(value);
  }

  return (
    <BlockStack gap="4">
      <Text as="h2" size="lg" weight="semibold">
        Favorites
      </Text>

      {favorites.length === 0 ? (
        <Paragraph tone="subdued" size="sm">
          No favorites yet. Star a pipeline or run to pin it here.
        </Paragraph>
      ) : (
        <BlockStack gap="4">
          <FavoritesSearchBar query={query} onQueryChange={handleQueryChange} />

          {paginated.length === 0 ? (
            <Paragraph tone="subdued" size="sm">
              No results for &ldquo;{query}&rdquo;.
            </Paragraph>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {paginated.map((item) => (
                <FavoriteCard key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          )}

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
