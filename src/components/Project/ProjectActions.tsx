import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  formatResourceCounts,
  totalResourceCount,
} from "@/components/Home/ProjectsSection/formatResourceCounts";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { Project } from "@/services/projects/types";
import { useDeleteProject } from "@/services/projects/useProjects";
import { copyToClipboard } from "@/utils/string";
import { tracking } from "@/utils/tracking";
import { getProjectUrl } from "@/utils/URL";

import { RenameProjectDialog } from "./RenameProjectDialog";

interface ProjectActionsProps {
  project: Project;
}

export function ProjectActions({ project }: ProjectActionsProps) {
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
    <BlockStack gap="1">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={() => setRenameOpen(true)}
        {...tracking("projects.rename_project_open")}
      >
        <Icon name="Pencil" size="sm" />
        Rename project
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={handleShare}
        {...tracking("projects.share_project")}
      >
        <Icon name="Share2" size="sm" />
        Share project
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-destructive hover:text-destructive"
        onClick={handleDelete}
        {...tracking("projects.delete_project_open")}
      >
        <Icon name="Trash2" size="sm" />
        Delete project
      </Button>

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
