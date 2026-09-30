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
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/appRoutes";
import { projectHomeRoute } from "@/routes/projectRoutes";
import type { ProjectSummary } from "@/services/projects/types";
import { formatDate, formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import {
  formatResourceCounts,
  visibleResourceCounts,
} from "./formatResourceCounts";

interface ProjectCardProps {
  project: ProjectSummary;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();
  const { confirmAndDelete, isDeleting, confirmation } = useDeleteProjectAction(
    project,
    { navigateAfterDelete: false },
  );
  const share = useShareProjectAction(project.id);

  const { pinned, isPinning, togglePin } = useProjectPin(project);
  const tangentEnabled = useTangentEnabled();
  const resourceCounts = visibleResourceCounts(
    project.resourceCounts,
    tangentEnabled,
  );

  const openDetails = () => {
    void navigate({
      to: APP_ROUTES.PROJECT_DETAIL,
      params: { projectId: project.id },
    });
  };

  return (
    <div
      className={cn(
        "relative min-h-56 rounded-lg border border-border bg-card transition-colors hover:bg-muted/50",
        isDeleting && "pointer-events-none opacity-50",
      )}
    >
      <Link
        to={projectHomeRoute(tangentEnabled)}
        params={{ projectId: project.id }}
        className="flex h-full flex-col justify-between gap-2 p-4"
        {...tracking("projects.project_card")}
      >
        <BlockStack gap="2" align="stretch">
          <InlineStack
            gap="2"
            blockAlign="center"
            wrap="nowrap"
            className="pr-8"
          >
            <Icon
              name={pinned ? "Pin" : "Folder"}
              size="lg"
              aria-label={pinned ? "Pinned" : undefined}
              className={cn(
                "shrink-0",
                pinned ? "text-brand-accent" : "text-muted-foreground",
              )}
            />
            <Text weight="semibold" className="min-w-0 truncate">
              {project.name}
            </Text>
          </InlineStack>

          {project.description && (
            <Paragraph
              size="sm"
              tone="subdued"
              className="line-clamp-3 wrap-break-word"
            >
              {project.description}
            </Paragraph>
          )}
        </BlockStack>

        <BlockStack gap="2" align="stretch">
          <Text size="xs" weight="medium" className="truncate">
            {formatResourceCounts(resourceCounts)}
          </Text>
          <Separator />
          <BlockStack gap="1" align="stretch">
            <Text size="xs" tone="subdued" className="truncate">
              {`Created ${formatDate(project.createdAt)}`}
            </Text>
            <Text size="xs" tone="subdued" className="truncate">
              {`Updated ${formatRelativeTime(project.updatedAt)}`}
            </Text>
          </BlockStack>
        </BlockStack>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            aria-label={`Project actions: ${project.name}`}
            {...tracking("projects.project_card_menu")}
          >
            <Icon name="EllipsisVertical" size="sm" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={isPinning}
            onSelect={() => void togglePin()}
            {...tracking("projects.pin_project", { new_value: !pinned })}
          >
            <Icon name={pinned ? "PinOff" : "Pin"} size="sm" />
            {pinned ? "Unpin project" : "Pin project"}
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
            <Icon name="Trash2" size="sm" />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog {...confirmation} />
    </div>
  );
}
