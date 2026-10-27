import { Link } from "@tanstack/react-router";

import { RunTable } from "@/components/Home/RunSection/RunTable";
import { FavoriteToggle } from "@/components/shared/FavoriteToggle";
import { Icon } from "@/components/ui/icon";
import { useFavorites } from "@/hooks/useFavorites";
import { usePipelineRunList } from "@/hooks/usePipelineRunList";
import { useRecentlyUsed, useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useRemotePipelinesPage } from "@/hooks/useRemotePipelinesPage";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useBackend } from "@/providers/BackendProvider";
import { useLocalPipelineNames } from "@/services/localPipelines/useLocalPipelines";
import { remotePipelinesEnabled } from "@/services/pipelineStorage/pipelineCreation";
import { formatRelativeTime } from "@/utils/date";
import { filtersToFilterQuery } from "@/utils/pipelineRunFilterUtils";

import {
  DashboardSectionFrame,
  type DashboardWidgetProps,
} from "./DashboardSectionFrame";
import { getRemotePipelinesFilterQuery } from "./pipelinesSearch";
import { ProjectsPreview } from "./ProjectsPreview";
import { SavedItemRow } from "./SavedItemRow";
import { getRecentlyViewedUrl } from "./TypePill";
import { useListedItems } from "./useListedItems";

export function DashboardWidget(props: DashboardWidgetProps) {
  switch (props.section.type) {
    case "projects":
      return <ProjectsPreview {...props} />;
    case "runs":
      return <RunsPreview {...props} />;
    case "pipelines":
      return <PipelinesPreview {...props} />;
    case "favorites":
      return <FavoriteSection {...props} />;
    case "recent":
    case "used":
    case "recent-components":
      return <HistorySection {...props} />;
    default:
      return <DashboardSectionFrame {...props} empty />;
  }
}

function FavoriteSection(props: DashboardWidgetProps) {
  const { favorites, removeFavorite } = useFavorites();
  const items = useListedItems(favorites).slice(0, 5);
  return (
    <DashboardSectionFrame {...props} empty={items.length === 0}>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {items.map((item) => (
          <SavedItemRow
            key={`${item.type}-${item.id}`}
            item={item}
            trackingId="homepage.favorites.item"
            onRemove={() => void removeFavorite(item.type, item.id)}
          />
        ))}
      </div>
    </DashboardSectionFrame>
  );
}

function HistorySection(props: DashboardWidgetProps) {
  const { recentlyViewed } = useRecentlyViewed();
  const { recentlyUsed } = useRecentlyUsed();
  const { track } = useAnalytics();
  const componentsOnly = props.section.type === "recent-components";
  const listed = useListedItems(
    componentsOnly
      ? recentlyUsed.filter((item) => item.type === "component")
      : props.section.type === "used"
        ? recentlyUsed
        : recentlyViewed,
  );
  const items = listed.slice(0, 5);
  return (
    <DashboardSectionFrame {...props} empty={items.length === 0}>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {items.map((item) => (
          <SavedItemRow
            key={`${item.type}-${item.id}`}
            item={item}
            trackingId={
              componentsOnly
                ? "homepage.recently_used_components.item"
                : "homepage.recently_viewed_pipelines.item"
            }
            onClick={() => {
              if (item.type === "component")
                track("component_library.row.click", {
                  component_id: item.id,
                  component_name: item.name,
                  component_source: "unknown",
                  surface: componentsOnly
                    ? "homepage_recent"
                    : "homepage_recently_viewed",
                });
            }}
          />
        ))}
      </div>
    </DashboardSectionFrame>
  );
}

function RunsPreview(props: DashboardWidgetProps) {
  const { configured, available, ready } = useBackend();
  const { data, isLoading, error } = usePipelineRunList({
    filterQuery: filtersToFilterQuery({ created_by: "me" }),
  });
  const runs = data?.pipeline_runs.slice(0, 10) ?? [];
  return (
    <DashboardSectionFrame
      {...props}
      unavailable={
        !configured || !available
          ? "Connect a backend to see your runs."
          : undefined
      }
      empty={runs.length === 0}
      loading={!ready || isLoading}
      error={error?.message}
    >
      <RunTable runs={runs} responsive />
    </DashboardSectionFrame>
  );
}

function PipelinesPreview(props: DashboardWidgetProps) {
  const { backendUrl, configured, available, ready } = useBackend();
  const local = useLocalPipelineNames();
  const remoteEnabled = remotePipelinesEnabled() && configured;
  const remote = useRemotePipelinesPage(
    backendUrl,
    undefined,
    remoteEnabled && available,
    getRemotePipelinesFilterQuery({ user: "me" }),
  );
  const items = [
    ...(remoteEnabled && available ? (remote.data?.pipelines ?? []) : []).map(
      (pipeline) => ({
        type: "remote-pipeline" as const,
        id: pipeline.id,
        name: pipeline.pipeline_name ?? pipeline.file_path,
        updated: pipeline.updated_at,
        author: pipeline.user_id,
      }),
    ),
    ...(local.data ?? []).map((name) => ({
      type: "pipeline" as const,
      id: name,
      name,
      updated: undefined,
      author: undefined,
    })),
  ].slice(0, 5);
  return (
    <DashboardSectionFrame
      {...props}
      empty={items.length === 0}
      loading={
        local.isLoading || (remoteEnabled && (!ready || remote.isLoading))
      }
      error={local.error?.message ?? remote.error?.message}
    >
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {items.map((item) => (
          <div
            key={`${item.type}-${item.id}`}
            className="flex min-w-0 items-center hover:bg-muted/50"
          >
            <Link
              to={getRecentlyViewedUrl(item)}
              className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 no-underline"
            >
              <Icon
                name="GitBranch"
                size="sm"
                className="shrink-0 text-muted-foreground"
              />
              <span
                className="min-w-0 flex-1 truncate text-sm"
                title={item.name}
              >
                {item.name}
              </span>
              <span
                className="hidden min-w-0 max-w-48 truncate text-xs text-muted-foreground @[52rem]/dashboard-section:block"
                title={item.author}
              >
                {item.author}
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground @[36rem]/dashboard-section:block">
                {item.updated
                  ? `Updated ${formatRelativeTime(new Date(item.updated))}`
                  : "Local pipeline"}
              </span>
            </Link>
            <div className="mr-3 hidden @[36rem]/dashboard-section:block">
              <FavoriteToggle type={item.type} id={item.id} name={item.name} />
            </div>
          </div>
        ))}
      </div>
    </DashboardSectionFrame>
  );
}
