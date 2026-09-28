import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useBackend } from "@/providers/BackendProvider";

export interface LazyBridgeAuth {
  getBackendUrl: () => string;
  getAuthToken: () => string | undefined;
  queryClient: QueryClient;
}

/**
 * Lazy getters for the backend url and auth token a tool bridge reads on every
 * call, so a bridge built once picks up backend/auth changes without rebuilding
 * the worker connection.
 */
export function useLazyBridgeAuth(): LazyBridgeAuth {
  const { backendUrl } = useBackend();
  const authStorage = useAuthLocalStorage();
  const queryClient = useQueryClient();

  const backendUrlRef = useRef(backendUrl);

  useEffect(() => {
    backendUrlRef.current = backendUrl;
  }, [backendUrl]);

  return {
    getBackendUrl: () => backendUrlRef.current,
    getAuthToken: () => authStorage.getToken(),
    queryClient,
  };
}
