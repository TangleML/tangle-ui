import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { getUserDetails } from "../utils/user";

export const userQueryOptions = queryOptions({
  queryKey: ["user"],
  staleTime: 1000 * 60 * 60 * 0.5, // 30 minutes
  queryFn: getUserDetails,
});

export function useUserDetails() {
  return useSuspenseQuery(userQueryOptions);
}
