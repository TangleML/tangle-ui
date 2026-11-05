import {
  RenameDialog,
  type RenameDialogProps,
} from "@/components/shared/Dialogs/RenameDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { getProject } from "@/services/projects/projectsService";
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

    // The PATCH replaces the whole metadata object, and the cached copy may
    // predate keys written since (such as Tangent's shared folder id).
    const latest = await getProject(project.id).catch((error: unknown) => {
      console.error("Failed to read the project before renaming it", error);
      notify("Failed to update project", "error");
      return undefined;
    });

    if (!latest) return;

    updateProject.mutate(
      {
        id: project.id,
        input: {
          name,
          // A name someone typed is a deliberate one, so the agent stops
          // offering to replace it.
          metadata: withoutProvisionalName(latest.metadata),
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
