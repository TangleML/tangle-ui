import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import {
  listSessionFiles,
  pinSessionFile,
  sessionFileUrl,
  unpinSessionFile,
} from "@/routes/v2/pages/Tangent/services/sessionFiles";
import { getErrorMessage } from "@/utils/string";

const SESSION_FILES_KEY = "tangent-session-files";

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
 * file here, which Tangent keeps for everyone.
 */
export function useProjectSessionFiles(projectId: string) {
  const { baseUrl } = useTangentBaseUrl(projectId);
  const { sessions } = useProjectSessions(projectId);
  const authToken = useRemoteEnvAuthToken();
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  const results = useQueries({
    queries: sessions.map(({ sessionId }) => ({
      queryKey: [SESSION_FILES_KEY, baseUrl, sessionId],
      queryFn: () =>
        baseUrl ? listSessionFiles({ baseUrl, sessionId, authToken }) : [],
      enabled: Boolean(baseUrl),
      staleTime: 30_000,
    })),
  });

  const files: ProjectFile[] = baseUrl
    ? results
        .flatMap((result) => result.data ?? [])
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
      const request = { baseUrl, sessionId: file.sessionId, authToken };
      if (pin) {
        await pinSessionFile({
          ...request,
          path: file.path,
          title: file.title,
        });
      } else {
        await unpinSessionFile({ ...request, path: file.path });
      }
    },
    onSuccess: (_, { file }) =>
      queryClient.invalidateQueries({
        queryKey: [SESSION_FILES_KEY, baseUrl, file.sessionId],
      }),
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
