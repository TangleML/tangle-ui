import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { FavoriteItem } from "@/hooks/useFavorites";
import type { RecentItem } from "@/hooks/useRecentlyViewed";
import { formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { getRecentlyViewedUrl, TypePill } from "./TypePill";

export function SavedItemRow({
  item,
  onRemove,
  trackingId,
  onClick,
}: {
  item: FavoriteItem | RecentItem;
  onRemove?: () => void;
  trackingId: string;
  onClick?: () => void;
}) {
  return (
    <div className="group flex min-w-0 items-center hover:bg-muted/50">
      <Link
        to={getRecentlyViewedUrl(item)}
        {...(item.type === "component"
          ? { search: { component: item.id } }
          : {})}
        {...tracking(trackingId)}
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 no-underline"
      >
        <TypePill type={item.type} id={item.id} />
        <span className="min-w-0 flex-1 truncate text-sm" title={item.name}>
          {item.name}
        </span>
        {"timestamp" in item && (
          <span
            className="hidden shrink-0 text-xs text-muted-foreground @[28rem]/dashboard-section:inline"
            title={new Date(item.timestamp).toLocaleString()}
          >
            {formatRelativeTime(new Date(item.timestamp))}
          </span>
        )}
      </Link>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="mr-3 size-6 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={onRemove}
          aria-label={`Remove ${item.name} from favorites`}
        >
          <Icon name="X" size="sm" />
        </Button>
      )}
    </div>
  );
}
