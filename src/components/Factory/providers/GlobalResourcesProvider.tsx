import { createContext, type ReactNode, useContext, useState } from "react";

import { RESOURCES } from "../data/resources";
import type { ResourceType } from "../types/resources";

const initialResources = Object.entries(RESOURCES).reduce(
  (acc, [type, resource]) => {
    if (resource.global) {
      acc[type as ResourceType] = 0;
    }
    return acc;
  },
  {} as Record<ResourceType, number>,
);

interface GlobalResourcesContextType {
  resources: Record<ResourceType, number>;
  updateResources: (updates: Partial<Record<ResourceType, number>>) => void;
  setResource: (resourceType: ResourceType, amount: number) => void;
  addResource: (resourceType: ResourceType, amount: number) => void;
  getResource: (resourceType: ResourceType) => number;
}

const GlobalResourcesContext = createContext<
  GlobalResourcesContextType | undefined
>(undefined);

interface GlobalResourcesProviderProps {
  children: ReactNode;
}

export const GlobalResourcesProvider = ({
  children,
}: GlobalResourcesProviderProps) => {
  const [resources, setResources] =
    useState<Record<ResourceType, number>>(initialResources);

  const updateResources = (updates: Partial<Record<ResourceType, number>>) => {
    setResources((prev) => {
      const updated = { ...prev };
      for (const key in updates) {
        const resource = key as ResourceType;
        updated[resource] = (updated[resource] || 0) + (updates[resource] || 0);
      }
      return updated;
    });
  };

  const setResource = (resourceType: ResourceType, amount: number) => {
    setResources((prev) => ({
      ...prev,
      [resourceType]: amount,
    }));
  };

  const addResource = (resourceType: ResourceType, amount: number) => {
    setResources((prev) => ({
      ...prev,
      [resourceType]: (prev[resourceType] || 0) + amount,
    }));
  };

  const getResource = (resourceType: ResourceType): number => {
    return resources[resourceType] || 0;
  };

  return (
    <GlobalResourcesContext.Provider
      value={{
        resources,
        updateResources,
        setResource,
        addResource,
        getResource,
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
