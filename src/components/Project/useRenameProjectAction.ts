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
import { useUpdateProject } from "@/services/projects/useProjects";

/**
 * Rename is offered from the project's page and from Tangent's header, and
 * both have to drop the provisional mark the same way. Requires a
 * `DialogProvider` above the caller.
 */
export function useRenameProjectAction(project: Project): () => Promise<void> {
  const { open } = useDialog();
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const updateProject = useUpdateProject();

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

    updateProject.mutate(
      {
        id: project.id,
        input: {
          name,
          // A name someone typed is a deliberate one, so the agent stops
          // offering to replace it.
          metadata: withoutProvisionalName(project.metadata),
        },
      },
      {
        onSuccess: () => {
          track("projects.rename_project_completed");
          notify("Project renamed", "success");
        },
      },
    );
  };
}
