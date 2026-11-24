import { useQuery } from "@tanstack/react-query";

import { userQueryOptions } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import {
  IdentityAssertionRequestError,
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

function isRefusal(error: unknown): boolean {
  return (
    error instanceof IdentityAssertionRequestError &&
    error.status >= 400 &&
    error.status < 500
  );
}

function retryDelay(error: unknown): number | false {
  return isRefusal(error) ? false : MIN_REFRESH_DELAY_MS;
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
  return data?.token;
}
