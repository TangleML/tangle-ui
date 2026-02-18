import { createContext, type ReactNode, useContext, useState } from "react";

import {
  GLOBAL_RESOURCE_KEYS,
  type GlobalResources,
  type GlobalResourceType,
} from "../data/resources";

interface GlobalResourcesContextType {
  resources: GlobalResources;
  updateResources: (updates: Partial<GlobalResources>) => void;
  setResource: (resourceType: GlobalResourceType, amount: number) => void;
  addResource: (resourceType: GlobalResourceType, amount: number) => void;
  getResource: (resourceType: GlobalResourceType) => number;
  resetResources: () => void;
}

const GlobalResourcesContext = createContext<
  GlobalResourcesContextType | undefined
>(undefined);

interface GlobalResourcesProviderProps {
  children: ReactNode;
}

const INITIAL_RESOURCES: GlobalResources = Object.fromEntries(
  GLOBAL_RESOURCE_KEYS.map((key) => [key, 0]),
) as GlobalResources;

export const GlobalResourcesProvider = ({
  children,
}: GlobalResourcesProviderProps) => {
  // Initialize all global resources to 0
  const [resources, setResources] =
    useState<GlobalResources>(INITIAL_RESOURCES);

  const updateResources = (updates: Partial<GlobalResources>) => {
    setResources((prev) => {
      const updated = { ...prev };

      (Object.keys(updates) as GlobalResourceType[]).forEach((resource) => {
        const amount = updates[resource];
        if (amount !== undefined) {
          updated[resource] = (updated[resource] || 0) + amount;
        }
      });

      return updated;
    });
  };

  const setResource = (resourceType: GlobalResourceType, amount: number) => {
    setResources((prev) => ({
      ...prev,
      [resourceType]: amount,
    }));
  };

  const addResource = (resourceType: GlobalResourceType, amount: number) => {
    setResources((prev) => ({
      ...prev,
      [resourceType]: (prev[resourceType] || 0) + amount,
    }));
  };

  const getResource = (resourceType: GlobalResourceType): number => {
    return resources[resourceType] || 0;
  };

  const resetResources = () => {
    setResources(INITIAL_RESOURCES);
  };

  return (
    <GlobalResourcesContext.Provider
      value={{
        resources,
        updateResources,
        setResource,
        addResource,
        getResource,
        resetResources,
      }}
    >
      {children}
    </GlobalResourcesContext.Provider>
  );
};

export const useGlobalResources = () => {
  const context = useContext(GlobalResourcesContext);
  if (!context) {
    throw new Error(
      "useGlobalResources must be used within GlobalResourcesProvider",
    );
  }
  return context;
};
