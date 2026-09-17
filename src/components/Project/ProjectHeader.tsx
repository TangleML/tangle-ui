import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  formatResourceCounts,
  totalResourceCount,
} from "@/components/Home/ProjectsSection/formatResourceCounts";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
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
import { Heading, Text } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { Project } from "@/services/projects/types";
import { useDeleteProject } from "@/services/projects/useProjects";
import { formatDate, formatRelativeTime } from "@/utils/date";
import { copyToClipboard } from "@/utils/string";
import { tracking } from "@/utils/tracking";
import { getProjectUrl } from "@/utils/URL";

import { RenameProjectDialog } from "./RenameProjectDialog";

interface ProjectHeaderProps {
  project: Project;
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const navigate = useNavigate();
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const deleteProject = useDeleteProject();
  const {
    handlers: confirmationHandlers,
    triggerDialog: triggerConfirmation,
    ...confirmationProps
  } = useConfirmationDialog();

  const resourceTotal = totalResourceCount(project.resourceCounts);

  const meta = [
    project.createdBy,
    `Created ${formatDate(project.createdAt)}`,
    `Updated ${formatRelativeTime(project.updatedAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");

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
        void navigate({ to: APP_ROUTES.PROJECTS });
      },
    });
  };

  return (
    <BlockStack gap="2">
      <Link
        to={APP_ROUTES.PROJECTS}
        className="w-fit text-muted-foreground hover:text-foreground"
        {...tracking("projects.project_page.back")}
      >
        <InlineStack gap="1" blockAlign="center">
          <Icon name="ArrowLeft" size="sm" aria-hidden="true" />
          <Text size="sm">Back to projects</Text>
        </InlineStack>
      </Link>

      <InlineStack gap="3" blockAlign="center" wrap="nowrap" className="w-full">
        <Icon
          name="Folder"
          size="xl"
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
        <Heading level={1} className="truncate">
          {project.name}
        </Heading>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={`Project actions: ${project.name}`}
              {...tracking("projects.project_page_menu")}
            >
              <Icon name="EllipsisVertical" size="sm" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => setRenameOpen(true)}
              {...tracking("projects.rename_project_open")}
            >
              <Icon name="Pencil" size="sm" />
              Rename project
            </DropdownMenuItem>
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
      </InlineStack>

      <Text size="sm" tone="subdued">
        {meta}
      </Text>

      <RenameProjectDialog
        project={project}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />

      <ConfirmationDialog
        {...confirmationProps}
        onConfirm={() => confirmationHandlers?.onConfirm()}
        onCancel={() => confirmationHandlers?.onCancel()}
      />
    </BlockStack>
  );
}
