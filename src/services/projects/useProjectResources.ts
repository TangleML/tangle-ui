import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";

import {
  createProjectResource,
  deleteProjectResource,
  getProjectResource,
  listProjectResources,
  updateProjectResource,
} from "./projectResourcesService";
import { projectQueryDefaults } from "./queryDefaults";
import type {
  CreateResourceInput,
  ListProjectResourcesParams,
  ProjectResourcePage,
  UpdateResourceInput,
} from "./types";
import { ProjectResourcesQueryKeys, ProjectsQueryKeys } from "./types";

/**
 * `ProjectsQueryKeys.Id` is a prefix of the project's resources *and* its runs,
 * so invalidating it plainly re-reads the resource list a second time and the
 * run feed for no reason. Only the project row itself needs it, for the
 * resource counts the dashboard shows.
 */
function invalidateProjectResources(
  queryClient: QueryClient,
  projectId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: ProjectResourcesQueryKeys.All(projectId),
  });
  void queryClient.invalidateQueries({
    queryKey: ProjectsQueryKeys.Id(projectId),
    exact: true,
  });
}

export function useProjectResources(
  projectId: string | undefined,
  params: ListProjectResourcesParams = {},
) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectResourcesQueryKeys.List(projectId ?? "", params),
    queryFn: () => {
      if (!projectId) {
        throw new Error("Project id is required");
      }
      return listProjectResources(projectId, params);
    },
    enabled: configured && available && Boolean(projectId),
    ...projectQueryDefaults,
  });
}

export function useProjectResource(
  projectId: string | undefined,
  resourceId: string | undefined,
) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectResourcesQueryKeys.Id(projectId ?? "", resourceId ?? ""),
    queryFn: () => {
      if (!projectId || !resourceId) {
        throw new Error("Project id and resource id are required");
      }
      return getProjectResource(projectId, resourceId);
    },
    enabled:
      configured && available && Boolean(projectId) && Boolean(resourceId),
    ...projectQueryDefaults,
  });
}

export function useCreateProjectResource(projectId: string) {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (input: CreateResourceInput) =>
      createProjectResource(projectId, input),
    onSuccess: () => {
      invalidateProjectResources(queryClient, projectId);
    },
    onError: () => {
      notify("Failed to create resource", "error");
    },
  });
}

/** For a caller that only learns the project as it adds — a "which project?" dialog. */
export function useAddResourceToProject() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: CreateResourceInput;
    }) => createProjectResource(projectId, input),
    onSuccess: (_resource, { projectId }) => {
      invalidateProjectResources(queryClient, projectId);
    },
    onError: () => {
      notify("Failed to create resource", "error");
    },
  });
}

export function useUpdateProjectResource(projectId: string) {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: ({
      resourceId,
      input,
    }: {
      resourceId: string;
      input: UpdateResourceInput;
    }) => updateProjectResource(projectId, resourceId, input),
    onSuccess: () => {
      invalidateProjectResources(queryClient, projectId);
    },
    onError: () => {
      notify("Failed to update resource", "error");
    },
  });
}

export function useDeleteProjectResource(projectId: string) {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (resourceId: string) =>
      deleteProjectResource(projectId, resourceId),
    /**
     * The row goes as soon as it is asked for. Waiting for the delete and then
     * a re-read of the whole list means two round trips of nothing happening,
     * which reads as a click that did not land.
     */
    onMutate: async (resourceId: string) => {
      const listsKey = ProjectResourcesQueryKeys.Lists(projectId);
      await queryClient.cancelQueries({ queryKey: listsKey });
      const lists = queryClient.getQueriesData<ProjectResourcePage>({
        queryKey: listsKey,
      });

      for (const [key, page] of lists) {
        if (!page) continue;
        queryClient.setQueryData<ProjectResourcePage>(key, {
          ...page,
          items: page.items.filter((item) => item.id !== resourceId),
          totalCount: Math.max(0, page.totalCount - 1),
        });
      }

      return { lists };
    },
    onError: (_error, _resourceId, context) => {
      for (const [key, page] of context?.lists ?? []) {
        queryClient.setQueryData(key, page);
      }
      notify("Failed to delete resource", "error");
    },
    onSettled: () => {
      invalidateProjectResources(queryClient, projectId);
    },
  });
}
