import type {
  Connection,
  FinalConnectionState,
  OnConnect,
  ReactFlowInstance,
  ReactFlowProps,
} from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import {
  GHOST_ESTIMATED_WIDTH,
  GHOST_NODE_ID,
  GHOST_OFFSET_X,
  GHOST_OFFSET_Y,
} from "@/routes/v2/pages/Editor/nodes/GhostNode/components/GhostNode";
import {
  connectNodes,
  createConnectedIONode,
} from "@/routes/v2/pages/Editor/store/actions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

type ValidHandle = NonNullable<FinalConnectionState["fromHandle"]> & {
  id: string;
  nodeId: string;
};

function isValidSourceHandle(
  connectionState: FinalConnectionState,
): connectionState is FinalConnectionState & {
  fromHandle: ValidHandle;
  fromNode: NonNullable<FinalConnectionState["fromNode"]>;
} {
  const { fromHandle, fromNode } = connectionState;
  if (
    !fromHandle?.id ||
    !fromHandle.nodeId ||
    !fromNode ||
    fromNode.type !== "task"
  )
    return false;
  return fromHandle.type === "source" || fromHandle.type === "target";
}

function validateConnectEndPreconditions(
  event: MouseEvent | TouchEvent,
  connectionState: FinalConnectionState,
) {
  const isGhostTarget = connectionState.toHandle?.nodeId === GHOST_NODE_ID;
  if (connectionState.isValid && !isGhostTarget) return null;
  if (!isValidSourceHandle(connectionState)) return null;
  if (!(event instanceof MouseEvent)) return null;

  return { fromHandle: connectionState.fromHandle, event };
}

function handleConnectEnd(
  event: MouseEvent,
  fromHandle: ValidHandle,
  undo: UndoGroupable,
  spec: ComponentSpec,
  reactFlowInstance: ReactFlowInstance,
) {
  const cursorFlowPos = reactFlowInstance.screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  });

  const ioType: "input" | "output" =
    fromHandle.type === "target" ? "input" : "output";

  const position = {
    x:
      ioType === "input"
        ? cursorFlowPos.x + GHOST_OFFSET_X - GHOST_ESTIMATED_WIDTH
        : cursorFlowPos.x + GHOST_OFFSET_X,
    y: cursorFlowPos.y + GHOST_OFFSET_Y,
  };

  createConnectedIONode(
    undo,
    spec,
    fromHandle.nodeId,
    fromHandle.id,
    position,
    ioType,
  );
}

export function useConnectionBehavior(
  spec: ComponentSpec | null,
  reactFlowInstance: ReactFlowInstance | null,
): Required<Pick<ReactFlowProps, "onConnect" | "onConnectEnd">> {
  const { keyboard } = useSharedStores();
  const { undo } = useEditorSession();

  const onConnect: OnConnect = (connection: Connection) => {
    if (!spec) return;
    if (
      !connection.source ||
      !connection.target ||
      !connection.sourceHandle ||
      !connection.targetHandle
    )
      return;
    if (connection.source === connection.target) return;

    connectNodes(undo, spec, {
      sourceNodeId: connection.source,
      sourceHandleId: connection.sourceHandle,
      targetNodeId: connection.target,
      targetHandleId: connection.targetHandle,
    });
  };

  const onConnectEnd = (
    event: MouseEvent | TouchEvent,
    connectionState: FinalConnectionState,
  ) => {
    if (!spec || !reactFlowInstance) return;
    if (!keyboard.pressed.has(CMDALT)) return;

    const validated = validateConnectEndPreconditions(event, connectionState);
    if (!validated) return;

    handleConnectEnd(
      validated.event,
      validated.fromHandle,
      undo,
      spec,
      reactFlowInstance,
    );
  };

  return { onConnect, onConnectEnd };
}
