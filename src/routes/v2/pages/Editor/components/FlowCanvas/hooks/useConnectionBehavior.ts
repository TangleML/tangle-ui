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
import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import { keyboardStore } from "@/routes/v2/shared/store/keyboardStore";

export function useConnectionBehavior(
  spec: ComponentSpec | null,
  reactFlowInstance: ReactFlowInstance | null,
): Required<Pick<ReactFlowProps, "onConnect" | "onConnectEnd">> {
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

    connectNodes(spec, {
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
    if (!keyboardStore.pressed.has(CMDALT)) return;

    const isGhostTarget = connectionState.toHandle?.nodeId === GHOST_NODE_ID;
    if (connectionState.isValid && !isGhostTarget) return;

    const fromHandle = connectionState.fromHandle;
    const fromNode = connectionState.fromNode;

    if (!fromHandle?.id || !fromNode || fromNode.type !== "task") return;
    if (fromHandle.type !== "source" && fromHandle.type !== "target") return;

    if (!(event instanceof MouseEvent)) return;

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
      spec,
      fromHandle.nodeId,
      fromHandle.id,
      position,
      ioType,
    );
  };

  return { onConnect, onConnectEnd };
}
