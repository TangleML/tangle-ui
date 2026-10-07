import type { Patch, SerializedActionCall } from "mobx-keystone";
import {
  ActionTrackingResult,
  onActionMiddleware,
  patchRecorder,
  resolvePath,
  serializeActionCall,
} from "mobx-keystone";

import type { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";

import type { CollabCommand } from "./protocol";
import { collectIdLeafPaths } from "./serializedAction";

export interface CapturedAction {
  command: CollabCommand;
  inverse: Patch[][];
}

export interface ActionCapture {
  dispose(): void;
  runBypassed<T>(fn: () => T): T;
}

function collectNewModelIds(root: ComponentSpec, forward: Patch[]): string[] {
  return collectIdLeafPaths(root, forward).map((path) => {
    const value = resolvePath(root, path).value;
    return typeof value === "string" ? value : "";
  });
}

/**
 * Captures every top-level action on `root` as a replayable collab command.
 * Applying remote actions re-enters the tree, so the replica runs those inside
 * `runBypassed` to keep them from being captured and re-sent.
 */
export function installActionCapture(
  root: ComponentSpec,
  onCaptured: (captured: CapturedAction) => void,
): ActionCapture {
  let bypassing = false;
  let recorder: ReturnType<typeof patchRecorder> | null = null;
  let serialized: SerializedActionCall | null = null;
  let actionName = "";

  const disposer = onActionMiddleware(root, {
    onStart(actionCall) {
      if (bypassing || recorder) return undefined;
      actionName = actionCall.actionName;
      // Serialize before the action attaches its arguments: once a model
      // instance is in the tree it serializes as a path, not a snapshot, so a
      // detached `addInput(input)` argument must be captured here.
      try {
        serialized = serializeActionCall(actionCall, root);
      } catch {
        serialized = null;
      }
      recorder = patchRecorder(root, { recording: true });
      return undefined;
    },
    onFinish(_actionCall, _ctx, ret) {
      const active = recorder;
      const call = serialized;
      const label = actionName;
      recorder = null;
      serialized = null;
      actionName = "";
      if (bypassing || !active) return undefined;
      active.recording = false;
      const events = active.events;
      active.dispose();

      if (ret.result !== ActionTrackingResult.Return) return undefined;

      const inverse = events.map((event) => event.inversePatches);
      const forward = events.flatMap((event) => event.patches);
      if (forward.length === 0) return undefined;

      const command: CollabCommand = call
        ? {
            kind: "action",
            call,
            newModelIds: collectNewModelIds(root, forward),
          }
        : { kind: "patches", label, patches: forward };
      onCaptured({ command, inverse });
      return undefined;
    },
  });

  return {
    dispose(): void {
      disposer();
      recorder?.dispose();
      recorder = null;
      serialized = null;
    },
    runBypassed<T>(fn: () => T): T {
      const previous = bypassing;
      bypassing = true;
      try {
        return fn();
      } finally {
        bypassing = previous;
      }
    },
  };
}
