import { type MouseEvent } from "react";

import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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

  if (!isFlagEnabled("dashboard")) return null;

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    toggleFavorite({ type, id, name });
  };

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
      <Icon name="Star" className={cn(active ? "fill-warning" : "fill-none")} />
    </Button>
  );
};
