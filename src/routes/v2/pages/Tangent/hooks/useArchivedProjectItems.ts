import { useMutation, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import {
  archivedTargets,
  setProjectItemArchived,
} from "@/routes/v2/pages/Tangent/services/projectArchive";
import { useProject } from "@/services/projects/useProjects";
import { getErrorMessage } from "@/utils/string";

/**
 * What's been archived out of the project's card, by workarea target. It's
 * kept on the project, so everyone sees the same card and the agent can
 * archive and restore too. Someone else may have archived something, so the
 * project is read again each time the card opens.
 */
export function useArchivedProjectItems(projectId: string) {
  const { data: project } = useProject(projectId, { refetchOnMount: "always" });
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const archived: ReadonlySet<string> = new Set(
    archivedTargets(project?.metadata),
  );

  const { mutate } = useMutation({
    mutationFn: ({ target, archive }: { target: string; archive: boolean }) =>
      setProjectItemArchived(queryClient, projectId, target, archive),
    onError: (error) => notify(getErrorMessage(error), "error"),
  });

  return {
    archived,
    archive: (target: string) => mutate({ target, archive: true }),
    restore: (target: string) => mutate({ target, archive: false }),
  };
}
