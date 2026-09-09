import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  buildLauncherSchemaFromCapabilities,
  type LauncherAnnotationSchema,
  type LauncherConfig,
  launcherTaskAnnotationSchema,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/AnnotationsEditor/utils";
import { useBackend } from "@/providers/BackendProvider";
import { LAUNCHER_CAPABILITIES } from "@/utils/constants";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

const LAUNCHER_CONFIG_QUERY_URL = "/api/launcher_config";

function useLauncherCapabilities() {
  const { backendUrl, configured, available } = useBackend();

  return useQuery<LauncherConfig>({
    queryKey: ["launcherCapabilities", backendUrl],
    refetchOnWindowFocus: false,
    enabled: LAUNCHER_CAPABILITIES && configured && available,
    queryFn: () =>
      fetchWithErrorHandling(
        new URL(LAUNCHER_CONFIG_QUERY_URL, backendUrl).toString(),
      ),
  });
}

export interface LauncherSchemaState {
  schema: LauncherAnnotationSchema;
  capabilitiesActive: boolean;
}

export function useLauncherAnnotationSchema(): LauncherSchemaState {
  const { data } = useLauncherCapabilities();

  return useMemo(() => {
    if (LAUNCHER_CAPABILITIES && data) {
      return {
        schema: buildLauncherSchemaFromCapabilities(data),
        capabilitiesActive: true,
      };
    }
    return {
      schema: launcherTaskAnnotationSchema,
      capabilitiesActive: false,
    };
  }, [data]);
}
