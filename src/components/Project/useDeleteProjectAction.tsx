import { useNavigate } from "@tanstack/react-router";
import type { ComponentProps } from "react";

import {
  formatResourceCounts,
  totalResourceCount,
  visibleResourceCounts,
} from "@/components/Home/ProjectsSection/formatResourceCounts";
import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import { useTangentEnabled } from "@/components/shared/Settings/useFlags";
import { Text } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { ProjectSummary } from "@/services/projects/types";
import { useDeleteProject } from "@/services/projects/useProjects";

interface DeleteProjectAction {
  confirmAndDelete: () => Promise<void>;
  isDeleting: boolean;
  confirmation: ComponentProps<typeof ConfirmationDialog>;
}

interface DeleteProjectOptions {
  navigateAfterDelete: boolean;
}

function describeWhatIsDestroyed(
  named: Record<string, number>,
  namedTotal: number,
  unnamed: number,
) {
  if (namedTotal === 0 && unnamed === 0) {
    return "This project is empty.";
  }

  const others = `${unnamed} other ${unnamed === 1 ? "item" : "items"}`;

  if (namedTotal === 0) {
    return `This will also delete ${others}.`;
  }

  const listed = formatResourceCounts(named);
  return unnamed === 0
    ? `This will also delete ${listed}.`
    : `This will also delete ${listed} and ${others}.`;
}

/**
 * Delete is offered from the project's page, from Tangent and from a tile in
 * the grid, and all three have to say the same thing about what is destroyed.
 * The caller renders `<ConfirmationDialog {...confirmation} />` where its
 * layout suits.
 *
 * A page showing the deleted project has to leave; a grid that merely loses a
 * tile stays, so every caller says which it is.
 */
export function useDeleteProjectAction(
  project: ProjectSummary,
  { navigateAfterDelete }: DeleteProjectOptions,
): DeleteProjectAction {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const deleteProject = useDeleteProject();
  const { handlers, triggerDialog, ...confirmationProps } =
    useConfirmationDialog();

  const tangentEnabled = useTangentEnabled();
  const named = visibleResourceCounts(project.resourceCounts, tangentEnabled);
  const namedTotal = totalResourceCount(named);
  // Everything is destroyed, including the kinds this reader cannot see, so the
  // warning counts all of them and names only the ones it can.
  const unnamed = totalResourceCount(project.resourceCounts) - namedTotal;

  const confirmAndDelete = async () => {
    const confirmed = await triggerDialog({
      title: `Delete "${project.name}"?`,
      description:
        "This permanently deletes the project and everything in it. This action cannot be undone.",
      content: (
        <Text tone="subdued">
          {describeWhatIsDestroyed(named, namedTotal, unnamed)}
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
        if (navigateAfterDelete) {
          void navigate({ to: APP_ROUTES.PROJECTS });
        }
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
