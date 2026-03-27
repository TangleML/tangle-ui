import { useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Play,
  Star,
  X,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import { type FavoriteItem, useFavorites } from "@/hooks/useFavorites";
import { EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";

const PAGE_SIZE = 10;

function getFavoriteUrl(item: FavoriteItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  return `${RUNS_BASE_PATH}/${item.id}`;
}

const FavoriteChip = ({ item }: { item: FavoriteItem }) => {
  const navigate = useNavigate();
  const { removeFavorite } = useFavorites();

  const handleClick = () => {
    navigate({ to: getFavoriteUrl(item) });
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeFavorite(item.type, item.id);
  };

  return (
    <div
      onClick={handleClick}
      title={item.name}
      className={`group flex items-center gap-1.5 pl-2 pr-1 py-1 border rounded-md cursor-pointer min-w-0 ${
        item.type === "pipeline"
          ? "bg-violet-50/50 hover:bg-violet-50 border-violet-100"
          : "bg-emerald-50/50 hover:bg-emerald-50 border-emerald-100"
      }`}
    >
      {item.type === "pipeline" ? (
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="text-sm truncate">{item.name}</span>
      <button
        onClick={handleRemove}
        className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

export const FavoritesSection = () => {
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
  // Reset to last valid page if filtered results shrink
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paginated = filtered.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-2">
      <InlineStack blockAlign="center" gap="1">
        <Star
          className="h-4 w-4 text-warning"
          fill="oklch(79.5% 0.184 86.047)"
        />
        <Text as="h2" size="sm" weight="semibold">
          Favorites
        </Text>
      </InlineStack>

      {favorites.length === 0 ? (
        <Paragraph tone="subdued" size="sm">
          No favorites yet. Star a pipeline or run to pin it here.
        </Paragraph>
      ) : (
        <div className="flex flex-col gap-2">
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
          <div className="flex flex-wrap gap-2">
            {paginated.map((item) => (
              <FavoriteChip key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>

          {totalPages > 1 && (
            <InlineStack blockAlign="center" gap="2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
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
                <ChevronRight className="h-4 w-4" />
              </Button>
            </InlineStack>
          )}
        </div>
      )}
    </div>
  );
};
