import { useQueryClient } from "@tanstack/react-query";

import { userQueryOptions } from "@/hooks/useUserDetails";

import { remoteEnvAuthToken } from "./useRemoteEnvAuthToken";

/**
 * Same-origin, the embed's requests carry the deployment's SSO cookie.
 * Cross-origin they carry none, so Tangent would attribute chat to its default
 * user, whose agents never see this browser's remote-env host.
 */
export function useTangentEmbedToken(
  baseUrl: string | null,
): (() => Promise<string | undefined>) | undefined {
  const queryClient = useQueryClient();
  const getToken = () =>
    queryClient
      .ensureQueryData(userQueryOptions)
      .then((user) => remoteEnvAuthToken(user.id))
      .catch(() => undefined);

  if (!baseUrl) return undefined;
  const { origin } = new URL(baseUrl, window.location.href);
  return origin === window.location.origin ? undefined : getToken;
}
