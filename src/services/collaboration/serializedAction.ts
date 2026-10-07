import type { Patch } from "mobx-keystone";
import {
  applyPatches,
  applySerializedActionAndSyncNewModelIds,
  isModel,
  patchRecorder,
  resolvePath,
} from "mobx-keystone";

import type { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";

import type { CollabCommand } from "./protocol";

export interface ApplyResult {
  ok: boolean;
  inverse: Patch[][];
}

function modelId(value: unknown): string | null {
  return isModel(value) ? value.$modelId : null;
}

/**
 * Rewrites the array indices in a serialized action's `targetPath` to the
 * positions its `targetPathIds` currently occupy, so a concurrent insert or
 * delete elsewhere in the tree does not fail the strict id check inside
 * `applySerializedActionAndSyncNewModelIds`. Returns null when an addressed
 * node is gone (e.g. a task the remote action targets was deleted locally).
 */
function retargetByIds(
  root: ComponentSpec,
  path: readonly (string | number)[],
  pathIds: readonly (string | null)[],
): (string | number)[] | null {
  const retargeted: (string | number)[] = [];
  let current: unknown = root;

  for (let i = 0; i < path.length; i++) {
    if (current === null || typeof current !== "object") return null;
    const id = pathIds[i];
    if (Array.isArray(current) && id !== null) {
      const index = current.findIndex((element) => modelId(element) === id);
      if (index < 0) return null;
      retargeted.push(index);
      current = current[index];
      continue;
    }
    const segment = path[i];
    retargeted.push(segment);
    current = (current as Record<string, unknown>)[String(segment)];
  }

  return retargeted;
}

/**
 * Walks an action's forward patches in creation order and returns the paths of
 * every model-id leaf they introduce (the `$id` of a `Binding` that
 * `connectNodes` creates, the ids carried by an added snapshot, ...). Both the
 * originating replica and every applier scan the same deterministic action
 * shape, so the k-th leaf refers to the same logical model everywhere — which
 * lets us sync ids by position instead of by absolute tree index.
 */
export function collectIdLeafPaths(
  root: ComponentSpec,
  patches: Patch[],
): (string | number)[][] {
  const leaves: (string | number)[][] = [];
  const scan = (value: unknown, path: (string | number)[]): void => {
    if (path.length > 0 && typeof value === "string") {
      const parent = resolvePath(root, path.slice(0, -1)).value;
      if (isModel(parent) && value === parent.$modelId) {
        leaves.push([...path]);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        path.push(index);
        scan(item, path);
        path.pop();
      });
      return;
    }
    if (typeof value === "object" && value !== null && !("$frozen" in value)) {
      for (const [key, child] of Object.entries(value)) {
        path.push(key);
        scan(child, path);
        path.pop();
      }
    }
  };

  for (const patch of patches) {
    if (patch.op === "add" || patch.op === "replace") {
      scan(patch.value, [...patch.path]);
    }
  }
  return leaves;
}

export function rewind(root: ComponentSpec, inverse: Patch[][]): void {
  for (let i = inverse.length - 1; i >= 0; i--) {
    applyPatches(root, inverse[i], true);
  }
}

export function applyCollabCommand(
  root: ComponentSpec,
  command: CollabCommand,
): void {
  if (command.kind === "patches") {
    applyPatches(root, command.patches);
    return;
  }

  const targetPath = retargetByIds(
    root,
    command.call.targetPath,
    command.call.targetPathIds,
  );
  if (!targetPath) throw new Error("collab target could not be resolved");

  const recorder = patchRecorder(root, { recording: true });
  try {
    applySerializedActionAndSyncNewModelIds(root, {
      ...command.call,
      targetPath,
      modelIdOverrides: [],
    });
  } finally {
    recorder.recording = false;
  }
  const forward = recorder.events.flatMap((event) => event.patches);
  recorder.dispose();

  const idPaths = collectIdLeafPaths(root, forward);
  const syncPatches: Patch[] = [];
  for (let i = 0; i < idPaths.length && i < command.newModelIds.length; i++) {
    syncPatches.push({
      op: "replace",
      path: idPaths[i],
      value: command.newModelIds[i],
    });
  }
  if (syncPatches.length > 0) applyPatches(root, syncPatches);
}

/**
 * Applies a wire command to `root` while recording its inverse patches. On
 * failure (a semantically impossible command, e.g. editing a deleted node) the
 * partial application is rewound and `ok` is false — the same no-op outcome
 * every replica reaches.
 */
export function applyCommandRecording(
  root: ComponentSpec,
  command: CollabCommand,
): ApplyResult {
  const recorder = patchRecorder(root, { recording: true });
  let ok = true;
  try {
    applyCollabCommand(root, command);
  } catch {
    ok = false;
  }
  recorder.recording = false;
  const inverse = recorder.events.map((event) => event.inversePatches);
  recorder.dispose();
  if (!ok) {
    rewind(root, inverse);
    return { ok: false, inverse: [] };
  }
  return { ok: true, inverse };
}
