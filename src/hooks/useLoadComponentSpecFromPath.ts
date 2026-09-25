import { useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { RUNS_BASE_PATH } from "@/routes/router";
import { fetchExecutionDetails } from "@/services/executionService";
import { loadPipelineByName } from "@/services/pipelineService";
import type { ComponentReferenceWithSpec } from "@/utils/componentStore";
import { prepareComponentRefForEditor } from "@/utils/prepareComponentRefForEditor";
import { getIdOrTitleFromPath } from "@/utils/URL";

export const useLoadComponentSpecFromPath = () => {
  const location = useLocation();

  const { backendUrl } = useBackend();
  const { setComponentSpec, clearComponentSpec, componentSpec } =
    useComponentSpec();

  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pathname = useMemo(() => location.pathname, [location.pathname]);
  const isRunPath = pathname.includes(RUNS_BASE_PATH);

  const { title, id } = useMemo(
    () => getIdOrTitleFromPath(pathname),
    [pathname],
  );

  useEffect(() => {
    const loadPipelineFromStorage = async () => {
      setError(null);

      if (!title && !id) {
        clearComponentSpec();
        return;
      }

      setIsLoadingPipeline(true);
      try {
        // load by run id
        if (id && isRunPath) {
          const result = await fetchExecutionDetails(String(id), backendUrl);

          if (result.task_spec?.componentRef?.spec) {
            const preparedComponentRef = await prepareComponentRefForEditor(
              result.task_spec.componentRef as ComponentReferenceWithSpec,
            );
            if (preparedComponentRef) {
              setComponentSpec(preparedComponentRef);
              return;
            }
          }
        }

        // load by title
        if (title && !isRunPath) {
          const result = await loadPipelineByName(title);
          if (result.error) {
            setError(result.error);
            clearComponentSpec();
            return;
          }

          if (result.experiment?.componentRef?.spec) {
            const preparedComponentRef = await prepareComponentRefForEditor(
              result.experiment.componentRef as ComponentReferenceWithSpec,
            );
            if (preparedComponentRef) {
              setComponentSpec(preparedComponentRef);
              return;
            }
          }
        }

        setError("No component spec found for the current path.");
        clearComponentSpec();
      } catch (error) {
        console.error("Error loading pipeline from storage:", error);
        if (error instanceof Error) {
          setError("Failed to load pipeline from storage: " + error.message);
        }
      } finally {
        setIsLoadingPipeline(false);
      }
    };

    loadPipelineFromStorage();
    return () => {
      clearComponentSpec();
    };
  }, [id, title, backendUrl, isRunPath, setComponentSpec, clearComponentSpec]);

  return {
    componentSpec,
    isLoading: isLoadingPipeline,
    enableApi: isRunPath,
    error,
  };
};
