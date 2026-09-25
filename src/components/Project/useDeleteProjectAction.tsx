import { useNavigate } from "@tanstack/react-router";
import type { ComponentProps } from "react";

import {
  formatResourceCounts,
  totalResourceCount,
  visibleResourceCounts,
} from "@/components/Home/ProjectsSection/formatResourceCounts";
import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Text } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { Project } from "@/services/projects/types";
import { useDeleteProject } from "@/services/projects/useProjects";

interface DeleteProjectAction {
  confirmAndDelete: () => Promise<void>;
  isDeleting: boolean;
  confirmation: ComponentProps<typeof ConfirmationDialog>;
}

/**
 * Deleting a project is offered from the project's own page and from Tangent,
 * and both have to say the same thing about what is about to be destroyed and
 * leave for the same place afterwards. The caller renders
 * `<ConfirmationDialog {...confirmation} />` wherever suits its layout.
 */
export function useDeleteProjectAction(project: Project): DeleteProjectAction {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const deleteProject = useDeleteProject();
  const { handlers, triggerDialog, ...confirmationProps } =
    useConfirmationDialog();

  const tangentEnabled = useFlagValue("tangent-shell");
  const resourceCounts = visibleResourceCounts(
    project.resourceCounts,
    tangentEnabled,
  );
  const resourceTotal = totalResourceCount(resourceCounts);

  const confirmAndDelete = async () => {
    const confirmed = await triggerDialog({
      title: `Delete "${project.name}"?`,
      description:
        "This permanently deletes the project and everything in it. This action cannot be undone.",
      content: (
        <Text tone="subdued">
          {resourceTotal === 0
            ? "This project is empty."
            : `This will also delete ${formatResourceCounts(resourceCounts)}.`}
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

  return {
    confirmAndDelete,
    isDeleting: deleteProject.isPending,
    confirmation: {
      ...confirmationProps,
      onConfirm: () => handlers?.onConfirm(),
      onCancel: () => handlers?.onCancel(),
    },
  };
}
