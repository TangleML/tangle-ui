import { useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { MINUTES } from "@/utils/constants";

import { listProjects } from "./projectsService";
import type { ProjectSummary } from "./types";
import { ProjectsQueryKeys } from "./types";

const PAGE_SIZE = 100;
const MAX_PAGES = 5;

interface AllProjects {
  items: ProjectSummary[];
  totalCount: number;
  reachedPageLimit: boolean;
}

/**
 * Every project the backend will hand over, up to a ceiling.
 *
 * `GET /api/projects/` filters on nothing but `created_by` and `workspace_id`,
 * so searching by name or by date has to happen here. Doing that over a single
 * page would quietly miss matches, so the pages are drained first and the
 * ceiling is reported rather than hidden.
 */
async function listEveryProject(): Promise<AllProjects> {
  const items: ProjectSummary[] = [];
  let pageToken: string | undefined;
  let totalCount = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await listProjects({ pageSize: PAGE_SIZE, pageToken });
    items.push(...result.items);
    totalCount = result.totalCount;

    if (!result.nextPageToken) {
      return { items, totalCount, reachedPageLimit: false };
    }
    pageToken = result.nextPageToken;
  }

  return { items, totalCount, reachedPageLimit: true };
}

export function useAllProjects() {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectsQueryKeys.EveryPage(),
    queryFn: listEveryProject,
    enabled: configured && available,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}
