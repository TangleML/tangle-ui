import { Icon, type IconName } from "@/components/ui/icon";
import type { FavoriteItem } from "@/hooks/useFavorites";
import type { RecentlyViewedItem } from "@/hooks/useRecentlyViewed";
import { cn } from "@/lib/utils";
import { getDefaultEditorPath } from "@/routes/editorRoutes";
import { APP_ROUTES } from "@/routes/router";
import { getDefaultRunPath } from "@/routes/runRoutes";

type ItemType = "pipeline" | "run" | "component";

const TYPE_CONFIG: Record<
  ItemType,
  { className: string; icon: IconName; label: string }
> = {
  pipeline: {
    className:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    icon: "GitBranch",
    label: "Pipeline",
  },
  run: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    icon: "Play",
    label: "Run",
  },
  component: {
    className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
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
  if (item.type === "pipeline") return getDefaultEditorPath(item.id);
  return getDefaultRunPath(item.id);
}

export function getRecentlyViewedUrl(item: RecentlyViewedItem): string {
  if (item.type === "pipeline") return getDefaultEditorPath(item.id);
  if (item.type === "run") return getDefaultRunPath(item.id);
  return APP_ROUTES.DASHBOARD_COMPONENTS;
}
