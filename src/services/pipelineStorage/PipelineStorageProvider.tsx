import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import { useBackend } from "@/providers/BackendProvider";
import { REMOTE_PIPELINES_ENABLED } from "@/utils/remotePipelines";
import { subscribeUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { PipelineStorageService } from "./PipelineStorageService";
import { FoldersQueryKeys } from "./types";

export const PipelineStorageCtx = createRequiredContext<PipelineStorageService>(
  "PipelineStorageContext",
);

export function PipelineStorageProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeUserPipelineWritten(() => {
        void queryClient.invalidateQueries({
          queryKey: FoldersQueryKeys.All(),
        });
      }),
    [queryClient],
  );

  return REMOTE_PIPELINES_ENABLED ? (
    <RemoteStorageProvider>{children}</RemoteStorageProvider>
  ) : (
    <LocalStorageProvider>{children}</LocalStorageProvider>
  );
}

function LocalStorageProvider({ children }: { children: ReactNode }) {
  const [service] = useState(() => new PipelineStorageService());
  return (
    <PipelineStorageCtx.Provider value={service}>
      {children}
    </PipelineStorageCtx.Provider>
  );
}

function RemoteStorageProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const auth = useAuthLocalStorage();
  const authorizationToken = useSyncExternalStore(
    auth.subscribe,
    auth.getToken,
  );
  const profile = auth.getJWT();
  const backendUrl = backend.backendUrl.replace(/\/+$/, "");
  const accountScope = JSON.stringify([
    backendUrl,
    profile?.auth_provider ?? null,
    profile?.user_id ?? null,
  ]);
  // eslint-disable-next-line no-restricted-syntax -- An account/backend change must replace the storage session, not mutate it.
  const service = useMemo(
    () =>
      new PipelineStorageService({
        connection: { backendUrl, authorizationToken },
        scope: accountScope,
      }),
    [backendUrl, authorizationToken, accountScope],
  );

  return (
    <PipelineStorageCtx.Provider value={service}>
      {children}
    </PipelineStorageCtx.Provider>
  );
}

export function usePipelineStorage(): PipelineStorageService {
  return useRequiredContext(PipelineStorageCtx);
}
