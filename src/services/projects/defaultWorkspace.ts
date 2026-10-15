import { getStorage } from "@/utils/typedStorage";

import type { Workspace } from "./types";

const LAST_USED_WORKSPACE_KEY = "tangle.projects.lastUsedWorkspaceId";

const storage = getStorage<
  typeof LAST_USED_WORKSPACE_KEY,
  { [LAST_USED_WORKSPACE_KEY]: unknown }
>();

export function activeWorkspaces(workspaces: readonly Workspace[]) {
  return workspaces.filter((workspace) => workspace.isActive);
}

export function pickDefaultWorkspace(
  workspaces: readonly Workspace[],
  lastUsedWorkspaceId: string | null,
): Workspace | undefined {
  const active = activeWorkspaces(workspaces);
  const lastUsed = active.find(
    (workspace) => workspace.id === lastUsedWorkspaceId,
  );
  if (lastUsed) return lastUsed;

  return active.toSorted(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )[0];
}

export function readLastUsedWorkspaceId(): string | null {
  const stored = storage.getItem(LAST_USED_WORKSPACE_KEY);
  return typeof stored === "string" ? stored : null;
}

export function rememberLastUsedWorkspace(workspaceId: string) {
  storage.setItem(LAST_USED_WORKSPACE_KEY, workspaceId);
}

export function subscribeToLastUsedWorkspace(onChange: () => void) {
  const handler = (event: StorageEvent) => {
    if (event.key === LAST_USED_WORKSPACE_KEY || event.key === null) {
      onChange();
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
