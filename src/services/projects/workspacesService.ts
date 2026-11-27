import {
  getWorkspaceApiWorkspacesWorkspaceIdGet,
  listWorkspacesApiWorkspacesGet,
} from "@/api/sdk.gen";

import { WorkspacesApiError } from "./errors";
import { mapWorkspace } from "./mappers";
import type { Workspace } from "./types";

export async function listWorkspaces(
  backendUrl?: string,
): Promise<Workspace[]> {
  const result = await listWorkspacesApiWorkspacesGet(
    backendUrl ? { baseUrl: backendUrl } : undefined,
  );
  if (!result.data) {
    throw new WorkspacesApiError(
      "Failed to list workspaces",
      result.response.status,
    );
  }
  return result.data.workspaces.map(mapWorkspace);
}

export async function getWorkspace(id: string): Promise<Workspace> {
  const result = await getWorkspaceApiWorkspacesWorkspaceIdGet({
    path: { workspace_id: id },
  });
  if (!result.data) {
    throw new WorkspacesApiError(
      `Failed to fetch workspace ${id}`,
      result.response.status,
    );
  }
  return mapWorkspace(result.data);
}
