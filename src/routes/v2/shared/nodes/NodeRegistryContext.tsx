import { createContext, type ReactNode, useContext } from "react";

import type { NodeTypeRegistry } from "./registry";

const NodeRegistryContext = createContext<NodeTypeRegistry | null>(null);

interface NodeRegistryProviderProps {
  registry: NodeTypeRegistry;
  children: ReactNode;
}

export function NodeRegistryProvider({
  registry,
  children,
}: NodeRegistryProviderProps) {
  return <NodeRegistryContext value={registry}>{children}</NodeRegistryContext>;
}

export function useNodeRegistry(): NodeTypeRegistry {
  const ctx = useContext(NodeRegistryContext);
  if (!ctx)
    throw new Error("useNodeRegistry must be used within NodeRegistryProvider");
  return ctx;
}
