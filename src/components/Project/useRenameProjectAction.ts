import {
  RenameDialog,
  type RenameDialogProps,
} from "@/components/shared/Dialogs/RenameDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { withoutProvisionalName } from "@/services/projects/provisionalName";
import type { Project } from "@/services/projects/types";
import { useUpdateProjectMetadata } from "@/services/projects/useProjects";

/**
 * Rename is offered from the project's page and from Tangent's header, and
 * both have to drop the provisional mark the same way. Requires a
 * `DialogProvider` above the caller.
 */
export function useRenameProjectAction(project: Project): () => Promise<void> {
  const { open } = useDialog();
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const updateProjectMetadata = useUpdateProjectMetadata();

  return async () => {
    const name = await open<string, RenameDialogProps>({
      component: RenameDialog,
      props: {
        title: "Rename Project",
        description: "Give this project a different name.",
        currentName: project.name,
        trackingPrefix: "projects.rename_project",
      },
      routeKey: "rename-project",
    }).catch(convertCancelErrorTo(undefined));

    if (!name) return;

    updateProjectMetadata.mutate(
      {
        id: project.id,
        name,
        // A name someone typed is a deliberate one, so the agent stops
        // offering to replace it.
        change: withoutProvisionalName,
      },
      {
        onSuccess: () => {
          track("projects.rename_project_completed");
          notify("Project renamed", "success");
        },
        onError: (error) => {
          console.error("Failed to rename the project", error);
        },
      },
    );
  };
}
