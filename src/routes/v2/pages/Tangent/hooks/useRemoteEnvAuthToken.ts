import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { userQueryOptions } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import {
  IdentityAssertionRequestError,
  IdentityAssertionUnsupportedError,
  type IdentityToken,
  identityToken,
  instanceIdFromTangentBaseUrl,
} from "@/routes/v2/pages/Tangent/services/identityAssertion";
import { MINUTES } from "@/utils/constants";

// Floors the refetch so a backend handing out an already-stale assertion
// cannot put the query in a tight loop, and paces retries after a failure.
const MIN_REFRESH_DELAY_MS = 1 * MINUTES;

export interface RemoteEnvAuthTokenParams {
  backendUrl: string;
  instanceId: string | undefined;
  userId: string | undefined;
}

export function remoteEnvAuthToken({
  backendUrl,
  instanceId,
  userId,
}: RemoteEnvAuthTokenParams): Promise<IdentityToken | null> {
  if (!userId || userId === "Unknown") return Promise.resolve(null);
  return identityToken({ backendUrl, instanceId, email: userId });
}

function refreshDelay(token: IdentityToken | null | undefined): number | false {
  if (!token?.refreshAtMs) return false;
  return Math.max(token.refreshAtMs - Date.now(), MIN_REFRESH_DELAY_MS);
}

function isUnsupported(error: unknown): boolean {
  return (
    error instanceof IdentityAssertionUnsupportedError ||
    (error instanceof IdentityAssertionRequestError && error.status === 404)
  );
}

function retryDelay(error: unknown): number | false {
  return isUnsupported(error) ? false : MIN_REFRESH_DELAY_MS;
}

function useHasExpired(expiresAtMs: number | undefined): boolean {
  const [expiredAtMs, setExpiredAtMs] = useState<number>();
  useEffect(() => {
    if (expiresAtMs === undefined) return;
    const timer = setTimeout(
      () => setExpiredAtMs(expiresAtMs),
      Math.max(expiresAtMs - Date.now(), 0),
    );
    return () => clearTimeout(timer);
  }, [expiresAtMs]);
  return expiresAtMs !== undefined && expiredAtMs === expiresAtMs;
}

export function useRemoteEnvAuthToken(
  tangentBaseUrl: string | null,
): string | undefined {
  const { backendUrl } = useBackend();
  const { data: user } = useQuery(userQueryOptions);
  const userId = user?.id;
  const instanceId = tangentBaseUrl
    ? instanceIdFromTangentBaseUrl(tangentBaseUrl, backendUrl)
    : undefined;

  const { data } = useQuery({
    queryKey: ["tangent", "identity-token", backendUrl, instanceId, userId],
    queryFn: () => remoteEnvAuthToken({ backendUrl, instanceId, userId }),
    enabled: Boolean(backendUrl) && Boolean(userId) && tangentBaseUrl !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: true,
    refetchInterval: ({ state }) =>
      state.status === "error"
        ? retryDelay(state.error)
        : refreshDelay(state.data),
  });
  const expired = useHasExpired(data?.expiresAtMs);
  return expired ? undefined : data?.token;
}
