import type {
  ReactFlowInstance,
  ReactFlowProps,
  XYPosition,
} from "@xyflow/react";
import type { DragEvent } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import type { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";
import type {
  NodeTypeManifest,
  UndoGroupable,
} from "@/routes/v2/shared/nodes/types";
import type { TaskSpec } from "@/utils/componentSpec";

import { useFileDropHandler } from "./useFileDropHandler";
import { useReplaceDropHandler } from "./useReplaceDropHandler";

interface DropPayload {
  task?: TaskSpec;
  [key: string]: unknown;
}

function isFileDrop(event: DragEvent<HTMLDivElement>): boolean {
  return event.dataTransfer.files.length > 0;
}

function parseDropPayload(
  event: DragEvent<HTMLDivElement>,
): DropPayload | null {
  const raw = event.dataTransfer.getData("application/reactflow");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse dropped data:", err);
    return null;
  }
}

function isReplaceTargetDrop(
  replaceTarget: string | null,
  payload: DropPayload | null,
): payload is DropPayload {
  return replaceTarget !== null && payload?.task !== undefined;
}

function isDropPayload(payload: DropPayload | null): payload is DropPayload {
  const supportedKeys = new Set(["task", "flex", "input", "output"]);
  return (
    payload !== null && new Set(Object.keys(payload)).isSubsetOf(supportedKeys)
  );
}

type DropBehaviorResult = Required<
  Pick<ReactFlowProps, "onDragOver" | "onDrop">
>;

export function useDropBehavior(
  spec: ComponentSpec | null,
  reactFlowInstance: ReactFlowInstance | null,
): DropBehaviorResult {
  const registry = useNodeRegistry();
  const { undo } = useEditorSession();
  const handleFileDrop = useFileDropHandler();
  const { detectReplaceTarget, flushReplaceState, performReplaceDrop } =
    useReplaceDropHandler(spec, reactFlowInstance);

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const position =
      reactFlowInstance && !isFileDrop(event)
        ? reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          })
        : null;

    detectReplaceTarget(position);
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!spec || !reactFlowInstance) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const replaceTarget = flushReplaceState();
    const payload = parseDropPayload(event);

    switch (true) {
      case isFileDrop(event):
        await handleFileDrop(event.dataTransfer.files[0], spec, position);
        break;

      case isReplaceTargetDrop(replaceTarget, payload):
        await performReplaceDrop(replaceTarget, payload?.task);
        break;

      case isDropPayload(payload):
        console.log("resolveDropHandler", payload);
        await resolveDropHandler(registry, payload)?.(spec, position, undo);
        break;
    }
  };

  return { onDragOver, onDrop };
}

function isValidDropHandler(
  dropDefinition: NodeTypeManifest["drop"] | undefined,
): dropDefinition is NonNullable<NodeTypeManifest["drop"]> {
  return (
    dropDefinition !== undefined &&
    dropDefinition.dataKey !== undefined &&
    dropDefinition.handler !== undefined
  );
}

function resolveDropHandler(registry: NodeTypeRegistry, payload: DropPayload) {
  const dropDefinition = registry
    .all()
    .find(
      (manifest) =>
        manifest.drop && payload[manifest.drop.dataKey] !== undefined,
    )?.drop;

  if (!isValidDropHandler(dropDefinition)) return undefined;

  return (spec: ComponentSpec, position: XYPosition, undo: UndoGroupable) =>
    dropDefinition.handler(
      spec,
      payload[dropDefinition.dataKey],
      position,
      undo,
    );
}
