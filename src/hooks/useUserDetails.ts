import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { getUserDetails } from "../utils/user";

export function getUserQueryOptions(backendUrl?: string) {
  return queryOptions({
    queryKey: backendUrl === undefined ? ["user"] : ["user", backendUrl],
    staleTime: 1000 * 60 * 60 * 0.5, // 30 minutes
    queryFn: () => getUserDetails(backendUrl),
  });
}

export const userQueryOptions = getUserQueryOptions();

export function useUserDetails() {
  return useSuspenseQuery(userQueryOptions);
}
