import { useQueryClient } from "@tanstack/react-query";

import { userQueryOptions } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { instanceIdFromTangentBaseUrl } from "@/routes/v2/pages/Tangent/services/identityAssertion";

import { remoteEnvAuthToken } from "./useRemoteEnvAuthToken";

/**
 * Same-origin, the embed's requests carry the deployment's SSO cookie.
 * Cross-origin they carry none, so Tangent would attribute chat to its default
 * user, whose agents never see this browser's remote-env host. The token is
 * the backend's identity assertion for the signed-in user, which Tangent
 * forwards when an agent acts on their behalf.
 */
export function useTangentEmbedToken(
  baseUrl: string | null,
): (() => Promise<string | undefined>) | undefined {
  const queryClient = useQueryClient();
  const { backendUrl } = useBackend();
  const instanceId = baseUrl
    ? instanceIdFromTangentBaseUrl(baseUrl)
    : undefined;
  const getToken = () =>
    queryClient
      .ensureQueryData(userQueryOptions)
      .then((user) =>
        remoteEnvAuthToken({ backendUrl, instanceId, userId: user.id }),
      )
      .then((token) => token?.token)
      .catch(() => undefined);

  if (!baseUrl) return undefined;
  const { origin } = new URL(baseUrl, window.location.href);
  return origin === window.location.origin ? undefined : getToken;
}
