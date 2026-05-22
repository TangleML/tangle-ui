import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import { APP_ROUTES } from "@/routes/router";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";

import { cleanupOrphanTourPipelines } from "./tourPipelineLifecycle";

/**
 * Removes any `__tour__*` pipelines lingering in storage. Tour pipelines
 * are deleted by the `/tour/$tourId` route on unmount, but a tab close or
 * crash skips that path — this sweep handles those orphans on app load.
 *
 * Skipped while the user is actually on a tour route so we don't race
 * with that route's own create-pipeline flow.
 */
export function TourOrphanCleanup() {
  const storage = usePipelineStorage();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  useEffect(() => {
    if (pathname.startsWith(APP_ROUTES.TOUR)) return;
    void cleanupOrphanTourPipelines(storage);
  }, [storage, pathname]);

  return null;
}
