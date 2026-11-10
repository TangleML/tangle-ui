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
  const { sessions } = useProjectSessions(projectId);
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

  return {
    files,
    reports: files.filter((file) => file.pinned),
    isLoading: results.some((result) => result.isPending),
    pin: (file: ProjectFile) => setPinned({ file, pin: true }),
    unpin: (file: ProjectFile) => setPinned({ file, pin: false }),
  };
}
