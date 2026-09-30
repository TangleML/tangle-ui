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
  pipelineReferenceId?: string;
  analyticsActionType?: string;
}

export const FavoriteToggle = ({
  type,
  id,
  name,
  pipelineReferenceId,
  analyticsActionType,
}: FavoriteToggleProps) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(type, id, pipelineReferenceId);

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    toggleFavorite({ type, id, name, pipelineReferenceId });
  };

  return (
    <Button
      onClick={handleClick}
      data-testid="favorite-toggle"
      aria-label={
        active ? `Remove ${name} from favorites` : `Add ${name} to favorites`
      }
      aria-pressed={active}
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
