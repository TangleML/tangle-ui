import type { EmbedResource, Tangent } from "@tangent/embed-react";
import { queryOptions } from "@tanstack/react-query";

export const sessionResourcesKey = (sessionId: string) => [
  "tangent-session-resources",
  sessionId,
];

/**
 * A chat's resources on its Tangent session. They hold both the files its
 * agents made and the runs it started or brought in, so one read serves both.
 */
export const sessionResourcesQuery = (tangent: Tangent, sessionId: string) =>
  queryOptions({
    queryKey: sessionResourcesKey(sessionId),
    queryFn: (): Promise<EmbedResource[]> => tangent.listResources(sessionId),
    staleTime: 30_000,
  });
