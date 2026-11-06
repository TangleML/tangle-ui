import { Link, useNavigate } from "@tanstack/react-router";

import { RunTable } from "@/components/Home/RunSection/RunTable";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { FavoriteToggle } from "@/components/shared/FavoriteToggle";
import { Icon } from "@/components/ui/icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFavorites } from "@/hooks/useFavorites";
import { usePipelineRunList } from "@/hooks/usePipelineRunList";
import { useRecentlyUsed, useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useRemotePipelinesPage } from "@/hooks/useRemotePipelinesPage";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useBackend } from "@/providers/BackendProvider";
import { useLocalPipelineNames } from "@/services/localPipelines/useLocalPipelines";
import { remotePipelinesEnabled } from "@/services/pipelineStorage/pipelineCreation";
import { formatDate } from "@/utils/date";
import { hasNewTabModifier } from "@/utils/dom";
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
      <RunTable runs={runs} responsive showHeader={props.section.width === 3} />
    </DashboardSectionFrame>
  );
}

function PipelinesPreview(props: DashboardWidgetProps) {
  const navigate = useNavigate();
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
        created: pipeline.created_at,
        updated: pipeline.updated_at,
        author: pipeline.user_id,
        version: pipeline.current_version,
      }),
    ),
    ...(local.data ?? []).map((name) => ({
      type: "pipeline" as const,
      id: name,
      name,
      created: undefined,
      updated: undefined,
      author: undefined,
      version: undefined,
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
      <Table
        aria-label="My Pipelines"
        className="table-fixed"
        containerClassName="overflow-hidden rounded-lg border border-border"
      >
        <colgroup>
          <col className="w-full @[36rem]/dashboard-section:w-2/3 @[52rem]/dashboard-section:w-1/4" />
          <col className="hidden w-[12%] @[52rem]/dashboard-section:table-column" />
          <col className="hidden w-[18%] @[52rem]/dashboard-section:table-column" />
          <col className="hidden w-[15%] @[52rem]/dashboard-section:table-column" />
          <col className="hidden w-1/3 @[36rem]/dashboard-section:table-column @[52rem]/dashboard-section:w-[15%]" />
          <col className="hidden w-[15%] @[52rem]/dashboard-section:table-column" />
          <col className="hidden w-12 @[36rem]/dashboard-section:table-column" />
        </colgroup>
        {props.section.width === 3 && (
          <TableHeader className="bg-muted/20 [&_th]:px-4">
            <TableRow className="text-xs">
              <TableHead>Name</TableHead>
              <TableHead className="hidden @[52rem]/dashboard-section:table-cell">
                ID
              </TableHead>
              <TableHead className="hidden @[52rem]/dashboard-section:table-cell">
                User
              </TableHead>
              <TableHead className="hidden @[52rem]/dashboard-section:table-cell">
                Created at
              </TableHead>
              <TableHead className="hidden @[36rem]/dashboard-section:table-cell">
                Updated at
              </TableHead>
              <TableHead className="hidden @[52rem]/dashboard-section:table-cell">
                Current version
              </TableHead>
              <TableHead className="hidden @[36rem]/dashboard-section:table-cell">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
        )}
        <TableBody className="[&_td]:h-12 [&_td]:px-4 [&_td]:py-2">
          {items.map((item) => (
            <TableRow
              key={`${item.type}-${item.id}`}
              className="cursor-pointer text-xs"
              onClick={(event) => {
                const destination = getRecentlyViewedUrl(item);
                if (hasNewTabModifier(event)) {
                  window.open(destination, "_blank", "noopener,noreferrer");
                } else {
                  void navigate({ to: destination });
                }
              }}
            >
              <TableCell>
                <Link
                  to={getRecentlyViewedUrl(item)}
                  onClick={(event) => event.stopPropagation()}
                  className="flex min-w-0 items-center gap-3 text-sm no-underline hover:underline"
                >
                  <Icon
                    name="GitBranch"
                    size="sm"
                    className="shrink-0 text-muted-foreground"
                  />
                  <span className="truncate" title={item.name}>
                    {item.name}
                  </span>
                </Link>
              </TableCell>
              <TableCell
                className="hidden @[52rem]/dashboard-section:table-cell"
                onClick={(event) => event.stopPropagation()}
              >
                {item.type === "remote-pipeline" ? (
                  <CopyText
                    size="xs"
                    className="truncate"
                    copyLabel="Copy pipeline ID"
                  >
                    {item.id}
                  </CopyText>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="hidden @[52rem]/dashboard-section:table-cell">
                <span className="block truncate" title={item.author}>
                  {item.author ?? "—"}
                </span>
              </TableCell>
              <TableCell className="hidden @[52rem]/dashboard-section:table-cell">
                <span className="block truncate" title={item.created}>
                  {item.created ? formatDate(item.created) : "—"}
                </span>
              </TableCell>
              <TableCell className="hidden @[36rem]/dashboard-section:table-cell">
                <span className="block truncate" title={item.updated}>
                  {item.updated ? formatDate(item.updated) : "Local pipeline"}
                </span>
              </TableCell>
              <TableCell className="hidden @[52rem]/dashboard-section:table-cell">
                <span className="block truncate" title={item.version}>
                  {item.version ?? "—"}
                </span>
              </TableCell>
              <TableCell className="hidden @[36rem]/dashboard-section:table-cell">
                <FavoriteToggle
                  type={item.type}
                  id={item.id}
                  name={item.name}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DashboardSectionFrame>
  );
}
