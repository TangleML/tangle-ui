/**
 * SpecCollectionProvider manages the collection of all ComponentSpecs
 * (root pipeline + deserialized subgraphs).
 *
 * This keeps spec storage outside of PipelineEditor, allowing navigation
 * to simply change which spec is active rather than relying on global state.
 */

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";

import type { ComponentSpec, ComponentSpecJson } from "@/models/componentSpec";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";

interface SpecCollectionContextValue {
  /** The root pipeline spec */
  rootSpec: ComponentSpec | null;
  /** Register the root spec */
  setRootSpec: (spec: ComponentSpec) => void;
  /** Clear all specs */
  clearSpecs: () => void;
  /** Get a nested spec by path key (e.g., "SubgraphA/SubgraphB") */
  getNestedSpec: (pathKey: string) => ComponentSpec | undefined;
  /** Register or get a nested spec (deserializes if needed) */
  getOrCreateNestedSpec: (
    pathKey: string,
    specJson: ComponentSpecJson,
  ) => ComponentSpec | undefined;
  /** Check if a nested spec exists */
  hasNestedSpec: (pathKey: string) => boolean;
}

const SpecCollectionContext = createContext<SpecCollectionContextValue | null>(
  null,
);

interface SpecCollectionProviderProps {
  children: ReactNode;
}

/**
 * Provider that manages the collection of all ComponentSpecs.
 * Root spec and nested subgraphs are stored here, outside of PipelineEditor.
 */
export function SpecCollectionProvider({
  children,
}: SpecCollectionProviderProps) {
  const rootSpecRef = useRef<ComponentSpec | null>(null);
  const nestedSpecsRef = useRef<Map<string, ComponentSpec>>(new Map());
  const idGenRef = useRef<IncrementingIdGenerator>(
    new IncrementingIdGenerator(),
  );

  const setRootSpec = useCallback((spec: ComponentSpec) => {
    rootSpecRef.current = spec;
    nestedSpecsRef.current = new Map();
    idGenRef.current = new IncrementingIdGenerator();
  }, []);

  const clearSpecs = useCallback(() => {
    rootSpecRef.current = null;
    nestedSpecsRef.current = new Map();
    idGenRef.current = new IncrementingIdGenerator();
  }, []);

  const getNestedSpec = useCallback((pathKey: string) => {
    return nestedSpecsRef.current.get(pathKey);
  }, []);

  const hasNestedSpec = useCallback((pathKey: string) => {
    return nestedSpecsRef.current.has(pathKey);
  }, []);

  const getOrCreateNestedSpec = useCallback(
    (pathKey: string, specJson: ComponentSpecJson) => {
      const existing = nestedSpecsRef.current.get(pathKey);
      if (existing) {
        return existing;
      }

      try {
        const deserializer = new YamlDeserializer(idGenRef.current);
        const nestedSpec = deserializer.deserialize(specJson);
        nestedSpecsRef.current.set(pathKey, nestedSpec);
        return nestedSpec;
      } catch (error) {
        console.error(
          `[SpecCollectionProvider] Failed to deserialize spec for path: ${pathKey}`,
          error,
        );
        return undefined;
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      get rootSpec() {
        return rootSpecRef.current;
      },
      setRootSpec,
      clearSpecs,
      getNestedSpec,
      getOrCreateNestedSpec,
      hasNestedSpec,
    }),
    [
      setRootSpec,
      clearSpecs,
      getNestedSpec,
      getOrCreateNestedSpec,
      hasNestedSpec,
    ],
  );

  return (
    <SpecCollectionContext.Provider value={value}>
      {children}
    </SpecCollectionContext.Provider>
  );
}

/**
 * Hook to access the spec collection.
 */
export function useSpecCollection(): SpecCollectionContextValue {
  const context = useContext(SpecCollectionContext);
  if (!context) {
    throw new Error(
      "useSpecCollection must be used within a SpecCollectionProvider",
    );
  }
  return context;
}
