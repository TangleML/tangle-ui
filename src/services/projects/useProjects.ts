import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useFavorites } from "@/hooks/useFavorites";
import { removeRecentlyViewed } from "@/hooks/useRecentlyViewed";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { MINUTES } from "@/utils/constants";

import { ProjectsApiError } from "./errors";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "./projectsService";
import type {
  CreateProjectInput,
  ListProjectsParams,
  UpdateProjectInput,
} from "./types";
import { ProjectsQueryKeys } from "./types";

const MAX_RETRIES = 3;

/**
 * A 4xx is the backend's settled answer, so retrying only delays it: without
 * this, a deleted project's url sits on a spinner for the length of three
 * backoffs before it can say the project is gone.
 */
function retryUnlessRefused(failureCount: number, error: Error) {
  if (
    error instanceof ProjectsApiError &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

export function useProjects(params: ListProjectsParams = {}) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectsQueryKeys.List(params),
    queryFn: () => listProjects(params),
    enabled: configured && available,
    retry: retryUnlessRefused,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}

export function useProject(id: string | undefined) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectsQueryKeys.Id(id ?? ""),
    queryFn: () => {
      if (!id) {
        throw new Error("Project id is required");
      }
      return getProject(id);
    },
    enabled: configured && available && Boolean(id),
    retry: retryUnlessRefused,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}

/**
 * The projects among these ids that still exist, in the order they were asked
 * for. A run's attribution outlives the project it names, so the ones that
 * have gone are simply absent rather than reported — there is nothing the
 * reader can do about a project that is not there.
 */
export function useProjectsById(ids: readonly string[]) {
  const { configured, available } = useBackend();

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ProjectsQueryKeys.Id(id),
      queryFn: () => getProject(id),
      enabled: configured && available,
      retry: retryUnlessRefused,
      staleTime: 5 * MINUTES,
      refetchOnWindowFocus: false,
    })),
  });

  return results.flatMap((result) => (result.data ? [result.data] : []));
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.All(),
      });
    },
    onError: () => {
      notify("Failed to create project", "error");
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      updateProject(id, input),
    onSuccess: (_project, { id }) => {
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.All(),
      });
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.Id(id),
      });
    },
    onError: () => {
      notify("Failed to update project", "error");
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const { removeFavorite } = useFavorites();

  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.All(),
      });
      // Removed rather than invalidated: an invalidated query keeps its data
      // and serves it to the next page that mounts it, so the project's own
      // page would come up fully furnished from the cache of a project that no
      // longer exists, and only then refetch its way to an error.
      queryClient.removeQueries({ queryKey: ProjectsQueryKeys.Id(id) });

      // The link outlives the project everywhere it was recorded.
      removeRecentlyViewed("project", id);
      void removeFavorite("project", id);
    },
    onError: () => {
      notify("Failed to delete project", "error");
    },
  });
}
