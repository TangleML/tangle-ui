import { type EmbedResource, useTangent } from "@tangent/embed-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const SESSION_RUNS_KEY = "tangent-session-runs";
const RUN_URI_PREFIX = "run://id/";

export interface SessionRun {
  id: string;
  name: string;
  addedAt: Date;
  dismissed: boolean;
}

export const sessionRunsKey = (sessionId: string | undefined) => [
  SESSION_RUNS_KEY,
  sessionId,
];

export function sessionRunsOf(resources: EmbedResource[]): SessionRun[] {
  return resources
    .flatMap((resource) =>
      resource.kind === "host" && resource.uri.startsWith(RUN_URI_PREFIX)
        ? [
            {
              id: resource.uri.slice(RUN_URI_PREFIX.length),
              name: resource.name,
              addedAt: new Date(resource.createdAt),
              dismissed: resource.meta?.dismissed === true,
            },
          ]
        : [],
    )
    .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
}

export function runEntry(
  run: { id: string; name: string },
  dismissed: boolean,
) {
  return {
    kind: "host" as const,
    name: run.name,
    uri: `${RUN_URI_PREFIX}${run.id}`,
    meta: dismissed ? { dismissed: true } : undefined,
  };
}

/**
 * The runs a chat started or brought in, newest first. They are kept on its
 * Tangent session as host entries, so they survive a reload, everyone in the
 * chat sees the same list, and the agent knows them too. Dismissing one only
 * hides it from the chat.
 */
export function useSessionRuns(sessionId: string | undefined) {
  const tangent = useTangent();
  const queryClient = useQueryClient();
  const { data: runs = [] } = useQuery({
    queryKey: sessionRunsKey(sessionId),
    queryFn: async () =>
      sessionRunsOf(await tangent.listResources(sessionId ?? "")),
    enabled: Boolean(sessionId),
    staleTime: 30_000,
  });

  async function dismiss(run: SessionRun) {
    if (!sessionId) return;
    await tangent.addResource(sessionId, runEntry(run, true));
    await queryClient.invalidateQueries({
      queryKey: sessionRunsKey(sessionId),
    });
  }

  return { runs, dismiss };
}

/**
 * Adds a run to a chat's runs the first time it shows up there. A run the chat
 * already has is left alone, so one that was dismissed stays dismissed.
 */
export function useRecordSessionRun() {
  const tangent = useTangent();
  const queryClient = useQueryClient();

  return async (sessionId: string, runId: string, name: string) => {
    const known = await queryClient.fetchQuery({
      queryKey: sessionRunsKey(sessionId),
      queryFn: async () =>
        sessionRunsOf(await tangent.listResources(sessionId)),
      staleTime: 30_000,
    });
    if (known.some((run) => run.id === runId)) return;
    await tangent.addResource(sessionId, runEntry({ id: runId, name }, false));
    await queryClient.invalidateQueries({
      queryKey: sessionRunsKey(sessionId),
    });
  };
}
