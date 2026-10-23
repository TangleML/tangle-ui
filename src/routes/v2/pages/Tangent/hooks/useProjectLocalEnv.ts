import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io } from "socket.io-client";

import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import {
  listTangentEnvironments,
  type TangentEnvironment,
} from "@/routes/v2/pages/Tangent/services/listTangentEnvironments";
import { getTangentSocketConfig } from "@/routes/v2/pages/Tangent/services/socketConfig";
import { isVscodeEnvironment } from "@/routes/v2/pages/Tangent/services/vscodeConnect";

const ENVIRONMENT_UPDATE_EVENT = "environment:update";

const ENVIRONMENTS_QUERY_SCOPE = ["tangent", "environments"] as const;

interface ProjectLocalEnv {
  localEnvironments: TangentEnvironment[];
  isLocalEnvConnected: boolean;
}

function environmentsQueryKey(baseUrl: string | null, sessionId: string) {
  return [...ENVIRONMENTS_QUERY_SCOPE, baseUrl, sessionId] as const;
}

/**
 * Whether a VS Code window is connected to the project's Shell. The extension
 * connects as one generic host eligible for every session, but a session's own
 * browser host masks it from that session's list, so this reads every project
 * session and unions the VS Code environments found. Tangent broadcasts
 * `environment:update` to every client on any host change, so one socket
 * refetches the whole set.
 */
export function useProjectLocalEnv(
  baseUrl: string | null,
  sessionIds: string[],
): ProjectLocalEnv {
  const queryClient = useQueryClient();
  const authToken = useRemoteEnvAuthToken();

  const results = useQueries({
    queries: sessionIds.map((sessionId) => ({
      queryKey: environmentsQueryKey(baseUrl, sessionId),
      queryFn: () => {
        if (!baseUrl) return [];
        return listTangentEnvironments({ baseUrl, sessionId, authToken });
      },
      enabled: Boolean(baseUrl),
    })),
  });

  useEffect(() => {
    if (!baseUrl) return;

    const { socketUrl, socketPath } = getTangentSocketConfig(baseUrl);
    const socket = io(socketUrl, {
      path: socketPath,
      auth: authToken ? { token: authToken } : {},
    });
    socket.on(ENVIRONMENT_UPDATE_EVENT, () => {
      void queryClient.invalidateQueries({
        queryKey: [...ENVIRONMENTS_QUERY_SCOPE, baseUrl],
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [baseUrl, authToken, queryClient]);

  const byId = new Map<string, TangentEnvironment>();
  for (const result of results) {
    for (const environment of result.data ?? []) {
      if (isVscodeEnvironment(environment)) {
        byId.set(environment.environmentId, environment);
      }
    }
  }
  const localEnvironments = [...byId.values()];

  return {
    localEnvironments,
    isLocalEnvConnected: localEnvironments.length > 0,
  };
}
