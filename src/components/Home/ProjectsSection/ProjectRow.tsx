import { Link, useNavigate } from "@tanstack/react-router";

import { useDeleteProjectAction } from "@/components/Project/useDeleteProjectAction";
import { useProjectPin } from "@/components/Project/useProjectPin";
import { useShareProjectAction } from "@/components/Project/useShareProjectAction";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { useTangentEnabled } from "@/components/shared/Settings/useFlags";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/appRoutes";
import { projectHomeRoute } from "@/routes/projectRoutes";
import type { ProjectSummary } from "@/services/projects/types";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { formatDate, formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import {
  formatResourceCounts,
  visibleResourceCounts,
} from "./formatResourceCounts";

interface ProjectRowProps {
  project: ProjectSummary;
}

export function ProjectRow({ project }: ProjectRowProps) {
  const navigate = useNavigate();
  const { confirmAndDelete, isDeleting, confirmation } = useDeleteProjectAction(
    project,
    { navigateAfterDelete: false },
  );
  const share = useShareProjectAction(project.id);

  const { pinned, isPinning, togglePin } = useProjectPin(project);
  const { data: workspaces } = useWorkspaces();
  const workspace = workspaces?.find(({ id }) => id === project.workspaceId);
  const tangentEnabled = useTangentEnabled();
  const resourceCounts = visibleResourceCounts(
    project.resourceCounts,
    tangentEnabled,
  );
  const contents = formatResourceCounts(resourceCounts);

  const openDetails = () => {
    void navigate({
      to: APP_ROUTES.PROJECT_DETAIL,
      params: { projectId: project.id },
    });
  };

  return (
    <div
      className={cn(
        "@container/project-row relative flex min-w-0 items-center border-b border-border last:border-b-0 transition-colors hover:bg-muted/50",
        isDeleting && "pointer-events-none opacity-50",
      )}
    >
      <Link
        to={projectHomeRoute(tangentEnabled)}
        params={{ projectId: project.id }}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
        {...tracking("projects.project_row")}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon
            name={pinned ? "Star" : "Folder"}
            size="md"
            aria-label={pinned ? "Favorite" : undefined}
            className={cn(pinned && "fill-warning text-warning")}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Text
            size="sm"
            weight="semibold"
            className="block min-w-0 truncate"
            title={project.name}
          >
            {project.name}
          </Text>
          <Text
            size="xs"
            tone="subdued"
            className="block truncate"
            title={contents}
          >
            {contents}
          </Text>
          {project.description && (
            <Text
              size="xs"
              tone="subdued"
              className="mt-1 hidden truncate wrap-break-word @[48rem]/project-row:block"
              title={project.description}
            >
              {project.description}
            </Text>
          )}
        </div>
        <div className="hidden min-w-0 max-w-48 shrink-0 space-y-1 text-right @[36rem]/project-row:block">
          {workspace && (
            <InlineStack
              gap="1"
              blockAlign="center"
              wrap="nowrap"
              className="min-w-0 justify-end"
            >
              <Icon
                name="Shapes"
                size="xs"
                aria-label="Workspace"
                className="shrink-0 text-muted-foreground"
              />
              <Text
                size="xs"
                tone="subdued"
                className="min-w-0 truncate"
                title={workspace.name}
              >
                {workspace.name}
              </Text>
            </InlineStack>
          )}
          <Text
            size="xs"
            tone="subdued"
            className="block"
            title={`Created ${formatDate(project.createdAt)} · Updated ${formatDate(project.updatedAt)}`}
          >
            {`Updated ${formatRelativeTime(project.updatedAt)}`}
          </Text>
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="mr-3 size-8 shrink-0 text-muted-foreground"
            // Keep keyboard actions disabled while deletion is pending.
            disabled={isDeleting}
            aria-label={`Project actions: ${project.name}`}
            {...tracking("projects.project_row_menu")}
          >
            <Icon name="EllipsisVertical" size="sm" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={isPinning}
            onSelect={() => void togglePin()}
            {...tracking("projects.favorite_project", { new_value: !pinned })}
          >
            <Icon
              name="Star"
              size="sm"
              className={cn(pinned && "fill-warning text-warning")}
            />
            {pinned ? "Remove from favorites" : "Add to favorites"}
          </DropdownMenuItem>
          {tangentEnabled && (
            <DropdownMenuItem
              onSelect={openDetails}
              {...tracking("projects.open_project_details")}
            >
              <Icon name="Info" size="sm" />
              Details
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={share}
            {...tracking("projects.share_project")}
          >
            <Icon name="Share2" size="sm" />
            Share project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => void confirmAndDelete()}
            {...tracking("projects.delete_project_open")}
          >
            <Icon name="Trash" size="sm" />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog {...confirmation} />
    </div>
  );
}
