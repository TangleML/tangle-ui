import { useMutation, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import {
  archivedTargets,
  setProjectItemArchived,
  withArchived,
} from "@/routes/v2/pages/Tangent/services/projectArchive";
import { type Project, ProjectsQueryKeys } from "@/services/projects/types";
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
  const archived = new Set(archivedTargets(project?.metadata));
  const projectKey = ProjectsQueryKeys.Id(projectId);

  const { mutate } = useMutation({
    mutationFn: ({ target, archive }: { target: string; archive: boolean }) =>
      setProjectItemArchived(projectId, target, archive),
    onMutate: ({ target, archive }) => {
      queryClient.setQueryData<Project>(projectKey, (current) =>
        current
          ? {
              ...current,
              metadata: withArchived(current.metadata, target, archive),
            }
          : current,
      );
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: projectKey, exact: true }),
  });

  return {
    isArchived: (target: string) => archived.has(target),
    archive: (target: string) => mutate({ target, archive: true }),
    restore: (target: string) => mutate({ target, archive: false }),
  };
}
