import { type MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { type FavoriteType, useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { tracking } from "@/utils/tracking";

interface FavoriteToggleProps {
  type: FavoriteType;
  id: string;
  name: string;
  analyticsActionType?: string;
  disabled?: boolean;
}

export const FavoriteToggle = ({
  type,
  id,
  name,
  analyticsActionType,
  disabled,
}: FavoriteToggleProps) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(type, id);

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    toggleFavorite({ type, id, name });
  };

  return (
    <Button
      onClick={handleClick}
      aria-label={
        active ? `Remove ${name} from favorites` : `Add ${name} to favorites`
      }
      aria-pressed={active}
      disabled={disabled}
      data-testid="favorite-toggle"
      className={cn(
        "w-fit h-fit p-1 hover:text-warning",
        active ? "text-warning" : "text-gray-500/50 dark:text-muted-foreground",
      )}
      variant="ghost"
      size="icon"
      {...(analyticsActionType
        ? tracking(analyticsActionType, { new_value: !active })
        : {})}
    >
      <Icon name="Star" className={cn(active ? "fill-warning" : "fill-none")} />
    </Button>
  );
};
