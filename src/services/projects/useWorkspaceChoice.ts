import { useState, useSyncExternalStore } from "react";

import {
  activeWorkspaces,
  pickDefaultWorkspace,
  readLastUsedWorkspaceId,
  subscribeToLastUsedWorkspace,
} from "./defaultWorkspace";
import type { Workspace } from "./types";

export interface WorkspaceChoice {
  workspaces: Workspace[];
  selected: Workspace | undefined;
  changedFromDefault: boolean;
  choose: (workspaceId: string) => void;
  reset: () => void;
}

export function useWorkspaceChoice(
  workspaces: readonly Workspace[] | undefined,
): WorkspaceChoice {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const lastUsedWorkspaceId = useSyncExternalStore(
    subscribeToLastUsedWorkspace,
    readLastUsedWorkspaceId,
  );

  const offered = activeWorkspaces(workspaces ?? []);
  const defaultWorkspace = pickDefaultWorkspace(
    workspaces ?? [],
    lastUsedWorkspaceId,
  );
  const selected =
    offered.find((workspace) => workspace.id === chosenId) ?? defaultWorkspace;

  return {
    workspaces: offered,
    selected,
    changedFromDefault: selected?.id !== defaultWorkspace?.id,
    choose: setChosenId,
    reset: () => setChosenId(null),
  };
}
