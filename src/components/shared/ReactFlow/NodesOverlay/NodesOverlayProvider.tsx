import type { ReactFlowInstance } from "@xyflow/react";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useRef,
} from "react";

import type {
  HydratedComponentReference,
  TaskSpec,
} from "@/utils/componentSpec";

type RegisterNodeOptions = {
  nodeId: string;
  taskSpec: TaskSpec;
  onNotify?: (message: NotifyMessage) => void;
};

export type UpdateOverlayMessage = {
  type: "update-overlay";
  data: {
    replaceWith: Map<string, HydratedComponentReference>;
    ids: string[];
  };
};

type HighlightMessage = {
  type: "highlight";
};

type ClearMessage = {
  type: "clear";
};

export type NotifyMessage =
  | HighlightMessage
  | ClearMessage
  | UpdateOverlayMessage;

interface NodesOverlayContextType {
  setReactFlowInstance: (instance: ReactFlowInstance) => void;
  registerNode: (options: RegisterNodeOptions) => () => void;
  fitNodeIntoView: (nodeId: string) => Promise<boolean>;
  getNodeIdsByDigest: (digest: string) => string[];
  // todo: consider EventTarget
  notifyNode: (nodeId: string, message: NotifyMessage) => void;
}

interface NodeRegistryRecord {
  taskSpec: TaskSpec;
  onNotify?: (message: NotifyMessage) => void;
}

const NodesOverlayContext = createContext<NodesOverlayContextType>({
  setReactFlowInstance: () => {},
  registerNode: () => () => {},
  fitNodeIntoView: () => Promise.resolve(false),
  getNodeIdsByDigest: () => [],
  notifyNode: () => {},
});

/**
 * Provider for the nodes overlay context.
 *
 * @param children - The children of the provider
 * @returns The NodesOverlayProvider component
 */
export const NodesOverlayProvider = ({ children }: PropsWithChildren<{}>) => {
  const instanceRef = useRef<ReactFlowInstance | null | undefined>(null);
  const nodesRef = useRef(new Map<string, NodeRegistryRecord>());

  const setReactFlowInstance = (instance: ReactFlowInstance) => {
    instanceRef.current = instance;
  };

  const registerNode = ({
    nodeId,
    taskSpec,
    onNotify,
  }: RegisterNodeOptions) => {
    nodesRef.current.set(nodeId, { taskSpec, onNotify });

    return () => {
      nodesRef.current.delete(nodeId);
    };
  };

  const fitNodeIntoView = async (nodeId: string) => {
    const node = instanceRef.current?.getNode(nodeId);
    if (!node) return false;

    return (
      (await instanceRef.current?.fitView({
        nodes: [{ id: nodeId }],
        duration: 200,
        maxZoom: 1,
      })) ?? false
    );
  };

  const getNodeIdsByDigest = (digest: string) => {
    return Array.from(nodesRef.current.entries())
      .filter(([_, { taskSpec }]) => taskSpec.componentRef.digest === digest)
      .sort((a, b) => {
        const aNode = instanceRef.current?.getNode(a[0]);
        const bNode = instanceRef.current?.getNode(b[0]);
        return (aNode?.selected ? 1 : 0) - (bNode?.selected ? 1 : 0);
      })
      .map(([nodeId]) => nodeId);
  };

  const notifyNode = (nodeId: string, message: NotifyMessage) => {
    const node = nodesRef.current.get(nodeId);
    if (!node) return;
    node.onNotify?.(message);
  };

  const value = {
    setReactFlowInstance,
    registerNode,
    fitNodeIntoView,
    getNodeIdsByDigest,
    notifyNode,
  };

  return (
    <NodesOverlayContext.Provider value={value}>
      {children}
    </NodesOverlayContext.Provider>
  );
};

export function useNodesOverlay() {
  return useContext(NodesOverlayContext);
}
