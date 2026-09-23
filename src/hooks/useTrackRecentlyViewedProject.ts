import { useEffect } from "react";

import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useProject } from "@/services/projects/useProjects";

/**
 * A project reached by a shared link is on nobody's list: the projects page
 * asks the backend for the ones the caller created. Recording the visit is what
 * makes it findable again once the link is gone.
 */
export function useTrackRecentlyViewedProject(
  projectId: string | null | undefined,
) {
  const { data: project, error } = useProject(projectId ?? undefined);
  const name = project?.name;

  useEffect(() => {
    // A project that has been deleted still has its last-known name in the
    // cache, so recording on the name alone would put a dead link straight
    // back on the list the moment someone followed it.
    if (!projectId || !name || error) return;

    addRecentlyViewed({ type: "project", id: projectId, name });
  }, [projectId, name, error]);
}
