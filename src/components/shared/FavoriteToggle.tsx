import { Star } from "lucide-react";
import { type MouseEvent, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { type FavoriteType, useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

interface FavoriteToggleProps {
  type: FavoriteType;
  id: string;
  name: string;
}

export const FavoriteToggle = ({ type, id, name }: FavoriteToggleProps) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(type, id);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      toggleFavorite({ type, id, name });
    },
    [type, id, name, toggleFavorite],
  );

  return (
    <Button
      onClick={handleClick}
      data-testid="favorite-toggle"
      className={cn(
        "w-fit h-fit p-1 hover:text-warning",
        active ? "text-warning" : "text-gray-500/50",
      )}
      variant="ghost"
      size="icon"
    >
      <Star
        className="h-4 w-4"
        fill={active ? "oklch(79.5% 0.184 86.047)" : "none"}
      />
    </Button>
  );
};
