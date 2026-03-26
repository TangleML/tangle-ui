import { createContext, type ReactNode, useContext, useState } from "react";

import { RESOURCES } from "../data/resources";
import type { ResourceType } from "../types/resources";

interface GlobalResourcesContextType {
  resources: Record<ResourceType, number>;
  updateResources: (updates: Record<ResourceType, number>) => void;
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
  // Initialize all global resources to 0
  const globalResourceTypes = Object.entries(RESOURCES)
    .filter(([_, resource]) => resource.global)
    .map(([type]) => type);

  const [resources, setResources] = useState<Record<ResourceType, number>>(
    Object.fromEntries(globalResourceTypes.map((type) => [type, 0])),
  );

  const updateResources = (updates: Record<ResourceType, number>) => {
    setResources((prev) => {
      const updated = { ...prev };
      Object.entries(updates).forEach(([resource, amount]) => {
        updated[resource] = (updated[resource] || 0) + amount;
      });
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
