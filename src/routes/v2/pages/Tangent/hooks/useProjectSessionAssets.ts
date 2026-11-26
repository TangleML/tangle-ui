import { useTangent } from "@tangent/embed-react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { sessionsOf } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { sessionRunsOf } from "@/routes/v2/pages/Tangent/hooks/useSessionRuns";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import {
  sessionFilesOf,
  sessionFileUrl,
  setSessionFilePinned,
} from "@/routes/v2/pages/Tangent/services/sessionFiles";
import { sessionResourcesQuery } from "@/routes/v2/pages/Tangent/services/sessionResources";
import { useEveryProjectResource } from "@/services/projects/useProjectResources";
import { getErrorMessage } from "@/utils/string";

export interface ProjectFile {
  key: string;
  sessionId: string;
  path: string;
  title: string;
  addedAt: Date;
  url: string;
  pinned: boolean;
}

/**
 * Files and recorded runs share a session resource list. Only the project view
 * reads every chat. A pin, an unpin or a live resource update refreshes the
 * originating chat in either view.
 */
export function useProjectSessionAssets(
  projectId: string,
  onlySessionId?: string,
) {
  const tangent = useTangent();
  const { baseUrl } = useTangentBaseUrl(projectId);
  const {
    data: sessionRows,
    isLoading: isLoadingSessions,
    error: sessionsError,
  } = useEveryProjectResource(projectId, ["agent_session"]);
  const sessions = sessionsOf(sessionRows);
  const authToken = useRemoteEnvAuthToken();
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  // Converted here rather than in a per-chat `select`: a new select each
  // render, building new dates each time, never settles.
  const included = onlySessionId
    ? sessions.filter(({ sessionId }) => sessionId === onlySessionId)
    : sessions;
  const results = useQueries({
    queries: included.map(({ sessionId }) => ({
      ...sessionResourcesQuery(tangent, sessionId),
      refetchOnWindowFocus: false,
    })),
  });

  const files: ProjectFile[] = baseUrl
    ? included
        .flatMap(({ sessionId }, index) =>
          sessionFilesOf(sessionId, results[index]?.data ?? []),
        )
        .map((record) => ({
          ...record,
          key: `${record.sessionId}:${record.path}`,
          url: sessionFileUrl(baseUrl, record.sessionId, record.path),
        }))
        .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
    : [];

  const { mutate: setPinned } = useMutation({
    mutationFn: async ({ file, pin }: { file: ProjectFile; pin: boolean }) => {
      if (!baseUrl) return;
      await setSessionFilePinned(
        queryClient,
        { baseUrl, authToken, ...file },
        pin,
      );
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });

  // A chat that can't be read, such as someone else's, is left out, so the
  // files have only failed to load when no chat could be read at all.
  const noChatCouldBeRead =
    results.length > 0 && results.every((result) => result.isLoadingError);

  return {
    files,
    runs: results.flatMap((result) => sessionRunsOf(result.data ?? [])),
    reports: files.filter((file) => file.pinned),
    isLoading: isLoadingSessions || results.some((result) => result.isPending),
    error: sessionsError ?? (noChatCouldBeRead ? results[0].error : null),
    pin: (file: ProjectFile) => setPinned({ file, pin: true }),
    unpin: (file: ProjectFile) => setPinned({ file, pin: false }),
  };
}
