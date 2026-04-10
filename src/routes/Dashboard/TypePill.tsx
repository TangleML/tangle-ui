import { Icon, type IconName } from "@/components/ui/icon";
import type { FavoriteItem } from "@/hooks/useFavorites";
import type { RecentlyViewedItem } from "@/hooks/useRecentlyViewed";
import { cn } from "@/lib/utils";
import { APP_ROUTES, EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";

type ItemType = "pipeline" | "run" | "component";

const TYPE_CONFIG: Record<
  ItemType,
  { className: string; icon: IconName; label: string }
> = {
  pipeline: {
    className: "bg-violet-100 text-violet-700",
    icon: "GitBranch",
    label: "Pipeline",
  },
  run: {
    className: "bg-emerald-100 text-emerald-700",
    icon: "Play",
    label: "Run",
  },
  component: {
    className: "bg-sky-100 text-sky-700",
    icon: "Package",
    label: "Component",
  },
};

export const TypePill = ({
  type,
  className,
}: {
  type: ItemType;
  className?: string;
}) => {
  const config = TYPE_CONFIG[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold shrink-0",
        config.className,
        className,
      )}
    >
      <Icon name={config.icon} size="sm" />
      {config.label}
    </span>
  );
};

export function getFavoriteUrl(item: FavoriteItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  return `${RUNS_BASE_PATH}/${item.id}`;
}

export function getRecentlyViewedUrl(item: RecentlyViewedItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  if (item.type === "run") return `${RUNS_BASE_PATH}/${item.id}`;
  return APP_ROUTES.DASHBOARD_COMPONENTS;
}
