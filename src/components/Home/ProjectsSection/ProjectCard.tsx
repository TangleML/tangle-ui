import { Link } from "@tanstack/react-router";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Paragraph, Text } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { ProjectSummary } from "@/services/projects/types";
import { useDeleteProject } from "@/services/projects/useProjects";
import { formatDate, formatRelativeTime } from "@/utils/date";
import { copyToClipboard } from "@/utils/string";
import { tracking } from "@/utils/tracking";
import { getProjectUrl } from "@/utils/URL";

import {
  formatResourceCounts,
  totalResourceCount,
} from "./formatResourceCounts";
import { ProjectColorPicker } from "./ProjectColorPicker";
import { projectColorStyles } from "./projectColors";
import { useProjectColors } from "./useProjectColors";

interface ProjectCardProps {
  project: ProjectSummary;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const deleteProject = useDeleteProject();
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const { getColor, setColor } = useProjectColors();
  const {
    handlers: confirmationHandlers,
    triggerDialog: triggerConfirmation,
    ...confirmationProps
  } = useConfirmationDialog();

  const resourceTotal = totalResourceCount(project.resourceCounts);
  const color = getColor(project.id);

  const handleShare = () => {
    copyToClipboard(getProjectUrl(project.id));
    notify("Project URL copied to clipboard", "success");
  };

  const handleDelete = async () => {
    const confirmed = await triggerConfirmation({
      title: `Delete "${project.name}"?`,
      description:
        "This permanently deletes the project and everything in it. This action cannot be undone.",
      content: (
        <Text tone="subdued">
          {resourceTotal === 0
            ? "This project is empty."
            : `This will also delete ${formatResourceCounts(project.resourceCounts)}.`}
        </Text>
      ),
    });

    if (!confirmed) return;

    deleteProject.mutate(project.id, {
      onSuccess: (result) => {
        track("projects.delete_project_completed", {
          deleted_resource_total: result.deletedResourceTotal,
        });
        notify(
          result.deletedResourceTotal === 0
            ? "Project deleted"
            : `Project deleted along with ${result.deletedResourceTotal} resources`,
          "success",
        );
      },
    });
  };

  return (
    <div
      className={cn(
        "relative min-h-56 rounded-lg border border-border bg-card transition-colors hover:bg-muted/50",
        deleteProject.isPending && "pointer-events-none opacity-50",
      )}
    >
      {color && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 w-1.5 rounded-l-lg",
            projectColorStyles[color].accent,
          )}
        />
      )}
      <Link
        to={APP_ROUTES.PROJECT_DETAIL}
        params={{ projectId: project.id }}
        className="flex h-full flex-col justify-between gap-2 p-4 pl-5"
        {...tracking("projects.project_card")}
      >
        <BlockStack gap="2">
          <InlineStack
            gap="2"
            blockAlign="center"
            wrap="nowrap"
            className="pr-8"
          >
            <Icon
              name="Folder"
              size="lg"
              className={cn(
                "shrink-0",
                color
                  ? projectColorStyles[color].text
                  : "text-muted-foreground",
              )}
            />
            <Text weight="semibold" className="truncate">
              {project.name}
            </Text>
          </InlineStack>

          {project.description && (
            <Paragraph size="sm" tone="subdued" className="line-clamp-3">
              {project.description}
            </Paragraph>
          )}
        </BlockStack>

        <BlockStack gap="2">
          <Text size="xs" weight="medium" className="truncate">
            {formatResourceCounts(project.resourceCounts)}
          </Text>
          <Separator />
          <BlockStack gap="1">
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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Icon name="Palette" size="sm" />
              Colour
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-2">
              <ProjectColorPicker
                value={color}
                onChange={(next) => {
                  setColor(project.id, next);
                  track("projects.set_project_color", {
                    color: next ?? "none",
                  });
                }}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            onSelect={handleShare}
            {...tracking("projects.share_project")}
          >
            <Icon name="Share2" size="sm" />
            Share project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onSelect={handleDelete}
            {...tracking("projects.delete_project_open")}
          >
            <Icon name="Trash2" size="sm" />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        {...confirmationProps}
        onConfirm={() => confirmationHandlers?.onConfirm()}
        onCancel={() => confirmationHandlers?.onCancel()}
      />
    </div>
  );
}
