/**
 * SpecContext provides the current ComponentSpec to ReactFlow nodes
 * without prop drilling through ReactFlow internals.
 *
 * This is used by TaskNode and IONode to access the spec for rendering.
 */

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import type { ComponentSpec } from "@/models/componentSpec";

interface SpecContextValue {
  spec: ComponentSpec | null;
}

const SpecContext = createContext<SpecContextValue | null>(null);

interface SpecProviderProps {
  spec: ComponentSpec | null;
  children: ReactNode;
}

/**
 * Provider that wraps ReactFlow to make the current spec available
 * to all nodes without prop drilling.
 */
export function SpecProvider({ spec, children }: SpecProviderProps) {
  return (
    <SpecContext.Provider value={{ spec }}>{children}</SpecContext.Provider>
  );
}

/**
 * Hook to access the current spec from within ReactFlow nodes.
 * Returns null if no spec is loaded.
 */
export function useSpec(): ComponentSpec | null {
  const context = useContext(SpecContext);
  if (!context) {
    throw new Error("useSpec must be used within a SpecProvider");
  }
  return context.spec;
}
