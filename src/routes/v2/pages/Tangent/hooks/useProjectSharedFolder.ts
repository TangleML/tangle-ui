import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import { createTangentSharedFolder } from "@/routes/v2/pages/Tangent/services/sharedFolders";
import {
  readProjectSharedFolderId,
  withProjectSharedFolderId,
} from "@/services/projects/projectSharedFolder";
import { getProject, updateProject } from "@/services/projects/projectsService";
import { ProjectsQueryKeys } from "@/services/projects/types";

interface ProvisionParams {
  projectId: string;
  baseUrl: string;
  authToken: string;
}

/**
 * Metadata is read from the server rather than the cache because the PATCH
 * replaces the whole object, and a stale copy would drop keys written since.
 * It is read again after the folder is made so a folder another tab saved in
 * the meantime wins, leaving ours unused rather than splitting the project's
 * memory across two stores.
 */
async function provisionSharedFolder({
  projectId,
  baseUrl,
  authToken,
}: ProvisionParams): Promise<string> {
  const project = await getProject(projectId);
  const existing = readProjectSharedFolderId(project.metadata);
  if (existing) return existing;

  const folder = await createTangentSharedFolder({
    baseUrl,
    authToken,
    name: project.name,
  });

  const latest = await getProject(projectId);
  const saved = readProjectSharedFolderId(latest.metadata);
  if (saved) return saved;

  await updateProject(projectId, {
    metadata: withProjectSharedFolderId(latest.metadata, folder.id),
  });
  return folder.id;
}

/**
 * Returns the project's shared folder id, making the folder on first use. A
 * session must still start when Tangent or the project API refuses, so every
 * failure resolves to undefined and the session goes without the folder.
 *
 * Mutations sharing a scope run one at a time, and provisioning reads the
 * project first, so a start queued behind another reuses the folder it saved
 * instead of making a second one.
 */
export function useProjectSharedFolder(
  projectId: string,
): () => Promise<string | undefined> {
  const queryClient = useQueryClient();
  const { baseUrl } = useTangentBaseUrl(projectId);
  const authToken = useRemoteEnvAuthToken();

  const { mutateAsync } = useMutation({
    scope: { id: `tangent-shared-folder:${projectId}` },
    mutationFn: (params: Omit<ProvisionParams, "projectId">) =>
      provisionSharedFolder({ projectId, ...params }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.Id(projectId),
      });
    },
  });

  return async () => {
    if (!baseUrl || !authToken) return undefined;
    try {
      return await mutateAsync({ baseUrl, authToken });
    } catch (error) {
      console.error("Failed to provision the project's shared folder", error);
      return undefined;
    }
  };
}
