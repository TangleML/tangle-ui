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
  const [resources, setResources] = useState<GlobalResources>(
    Object.fromEntries(GLOBAL_RESOURCE_KEYS.map((type) => [type, 0])) as Record<
      GlobalResourceType,
      number
    >,
  );

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
