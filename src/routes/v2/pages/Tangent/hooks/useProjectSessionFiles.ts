import { useTangent } from "@tangent/embed-react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import {
  sessionFilesOf,
  sessionFileUrl,
  setSessionFilePinned,
} from "@/routes/v2/pages/Tangent/services/sessionFiles";
import { sessionResourcesQuery } from "@/routes/v2/pages/Tangent/services/sessionResources";
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
 * Every file the project's chats made, newest first. The pinned ones are its
 * reports: an agent pins what's ready to share, and anyone can pin or unpin a
 * file here, which Tangent keeps for everyone. The open chat says when its
 * files change; the rest are read again whenever the card opens.
 */
export function useProjectSessionFiles(projectId: string) {
  const tangent = useTangent();
  const { baseUrl } = useTangentBaseUrl(projectId);
  const {
    sessions,
    isLoading: isLoadingSessions,
    error: sessionsError,
  } = useProjectSessions(projectId);
  const authToken = useRemoteEnvAuthToken();
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  // Converted here rather than in a per-chat `select`: a new select each
  // render, building new dates each time, never settles.
  const results = useQueries({
    queries: sessions.map(({ sessionId }) => ({
      ...sessionResourcesQuery(tangent, sessionId),
      refetchOnMount: "always" as const,
    })),
  });

  const files: ProjectFile[] = baseUrl
    ? sessions
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
    reports: files.filter((file) => file.pinned),
    isLoading: isLoadingSessions || results.some((result) => result.isPending),
    error: sessionsError ?? (noChatCouldBeRead ? results[0].error : null),
    pin: (file: ProjectFile) => setPinned({ file, pin: true }),
    unpin: (file: ProjectFile) => setPinned({ file, pin: false }),
  };
}
