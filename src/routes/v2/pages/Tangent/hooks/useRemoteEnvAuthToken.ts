import { useQuery } from "@tanstack/react-query";

import { userQueryOptions } from "@/hooks/useUserDetails";
import { createUnsignedJwt } from "@/routes/v2/pages/Tangent/services/createUnsignedJwt";

export function useRemoteEnvAuthToken(): string | undefined {
  const { data } = useQuery(userQueryOptions);
  const email = data?.id;
  if (!email || email === "Unknown") return undefined;
  return createUnsignedJwt({ email });
}
