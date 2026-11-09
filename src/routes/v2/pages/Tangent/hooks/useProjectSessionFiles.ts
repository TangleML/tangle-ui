import { useQueries } from "@tanstack/react-query";
import { useState } from "react";

import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import {
  listSessionFiles,
  sessionFileUrl,
} from "@/routes/v2/pages/Tangent/services/listSessionFiles";
import {
  defaultPlacement,
  type FilePlacement,
} from "@/routes/v2/pages/Tangent/services/projectFiles";
import { getStorage } from "@/utils/typedStorage";

const PLACEMENT_KEY = "tangent-project-file-placement";

const storage = getStorage<
  typeof PLACEMENT_KEY,
  { [PLACEMENT_KEY]: Record<string, FilePlacement> }
>();

export interface ProjectFile {
  key: string;
  sessionId: string;
  path: string;
  title: string;
  addedAt: Date;
  url: string;
  placement: FilePlacement;
}

/**
 * Every file the project's chats pinned, newest first, split into finished
 * reports and working files. Where someone moved a file is kept in this
 * browser and wins over the default.
 */
export function useProjectSessionFiles(projectId: string) {
  const { baseUrl } = useTangentBaseUrl(projectId);
  const { sessions } = useProjectSessions(projectId);
  const authToken = useRemoteEnvAuthToken();
  const [placements, setPlacements] = useState<Record<string, FilePlacement>>(
    () => storage.getItem(PLACEMENT_KEY) ?? {},
  );

  const results = useQueries({
    queries: sessions.map(({ sessionId }) => ({
      queryKey: ["tangent-session-files", baseUrl, sessionId],
      queryFn: () =>
        baseUrl ? listSessionFiles({ baseUrl, sessionId, authToken }) : [],
      enabled: Boolean(baseUrl),
      staleTime: 30_000,
    })),
  });

  const files: ProjectFile[] = baseUrl
    ? results
        .flatMap((result) => result.data ?? [])
        .map((record) => {
          const key = `${record.sessionId}:${record.path}`;
          return {
            ...record,
            key,
            url: sessionFileUrl(baseUrl, record.sessionId, record.path),
            placement: placements[key] ?? defaultPlacement(record.path),
          };
        })
        .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
    : [];

  function place(file: ProjectFile, placement: FilePlacement) {
    const next = { ...placements, [file.key]: placement };
    setPlacements(next);
    storage.setItem(PLACEMENT_KEY, next);
  }

  return {
    reports: files.filter((file) => file.placement === "report"),
    workingFiles: files.filter((file) => file.placement === "working"),
    isLoading: results.some((result) => result.isPending),
    place,
  };
}
