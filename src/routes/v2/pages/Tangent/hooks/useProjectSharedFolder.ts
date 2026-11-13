import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import { createTangentSharedFolder } from "@/routes/v2/pages/Tangent/services/sharedFolders";
import {
  projectSharedFolderName,
  readProjectSharedFolderId,
  withProjectSharedFolderId,
} from "@/services/projects/projectSharedFolder";
import { getProject } from "@/services/projects/projectsService";
import { type Project, ProjectsQueryKeys } from "@/services/projects/types";
import { updateProjectMetadata } from "@/services/projects/updateProjectMetadata";

interface ProvisionParams {
  projectId: string;
  baseUrl: string;
  authToken: string;
}

interface ProvisionedFolder {
  id: string;
  saved: boolean;
}

/**
 * The project is read from the server rather than the cache, and read again
 * as the folder is saved, so a folder another tab saved in the meantime wins,
 * leaving ours unused rather than splitting the project's memory across two
 * stores.
 */
async function provisionSharedFolder({
  projectId,
  baseUrl,
  authToken,
}: ProvisionParams): Promise<ProvisionedFolder> {
  const project = await getProject(projectId);
  const existing = readProjectSharedFolderId(project.metadata);
  if (existing) return { id: existing, saved: false };

  const folder = await createTangentSharedFolder({
    baseUrl,
    authToken,
    name: projectSharedFolderName(projectId),
  });

  const { project: latest, changed } = await updateProjectMetadata(
    projectId,
    (metadata) =>
      readProjectSharedFolderId(metadata)
        ? undefined
        : withProjectSharedFolderId(metadata, folder.id),
  );
  return changed
    ? { id: folder.id, saved: true }
    : {
        id: readProjectSharedFolderId(latest.metadata) ?? folder.id,
        saved: false,
      };
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
    onSuccess: ({ saved }) => {
      if (!saved) return;
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.Id(projectId),
      });
    },
  });

  return async () => {
    if (!baseUrl || !authToken) return undefined;
    const cached = queryClient.getQueryData<Project>(
      ProjectsQueryKeys.Id(projectId),
    );
    const cachedId = readProjectSharedFolderId(cached?.metadata);
    if (cachedId) return cachedId;
    try {
      const { id } = await mutateAsync({ baseUrl, authToken });
      return id;
    } catch (error) {
      console.error("Failed to provision the project's shared folder", error);
      return undefined;
    }
  };
}
