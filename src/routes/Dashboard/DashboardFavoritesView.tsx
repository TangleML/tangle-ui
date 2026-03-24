import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, GitBranch, Play, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import { type FavoriteItem, useFavorites } from "@/hooks/useFavorites";
import { EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";

const PAGE_SIZE = 16;

function getFavoriteUrl(item: FavoriteItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  return `${RUNS_BASE_PATH}/${item.id}`;
}

const FavoriteCard = ({ item }: { item: FavoriteItem }) => {
  const navigate = useNavigate();
  const { removeFavorite } = useFavorites();

  const isPipeline = item.type === "pipeline";

  return (
    <div
      onClick={() => navigate({ to: getFavoriteUrl(item) })}
      className={`group relative flex flex-col gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
        isPipeline
          ? "bg-violet-50/40 hover:bg-violet-50 border-violet-100"
          : "bg-emerald-50/40 hover:bg-emerald-50 border-emerald-100"
      }`}
    >
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeFavorite(item.type, item.id);
        }}
        className="absolute top-2 right-2 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label="Remove from favorites"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Type badge */}
      <InlineStack gap="1" blockAlign="center">
        {isPipeline ? (
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-violet-500" />
        ) : (
          <Play className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        )}
        <Text
          size="xs"
          weight="semibold"
          className={isPipeline ? "text-violet-600" : "text-emerald-600"}
        >
          {isPipeline ? "Pipeline" : "Run"}
        </Text>
      </InlineStack>

      {/* Name */}
      <Text size="sm" weight="semibold" className="truncate pr-4 leading-tight">
        {item.name}
      </Text>

      {/* ID */}
      <Text size="xs" className="truncate text-muted-foreground font-mono">
        {item.id}
      </Text>
    </div>
  );
};

export function DashboardFavoritesView() {
  const { favorites } = useFavorites();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? favorites.filter((f) => {
        const q = query.toLowerCase();
        return (
          f.id.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)
        );
      })
    : favorites;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paginated = filtered.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

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
          {/* Search */}
          <div className="relative w-64">
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
              className="pl-9 pr-8"
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

          {/* Grid */}
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

          {/* Pagination */}
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
