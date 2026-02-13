import { createContext, type ReactNode, useContext, useState } from "react";

import type { ComponentReference } from "@/utils/componentSpec";

interface ComponentPreviewContextType {
  hoveredComponent: ComponentReference | null;
  setHoveredComponent: (component: ComponentReference | null) => void;
}

export const ComponentPreviewContext =
  createContext<ComponentPreviewContextType | null>(null);

interface ComponentPreviewProviderProps {
  children: ReactNode;
}

export const ComponentPreviewProvider = ({
  children,
}: ComponentPreviewProviderProps) => {
  const [hoveredComponent, setHoveredComponent] =
    useState<ComponentReference | null>(null);

  return (
    <ComponentPreviewContext.Provider
      value={{ hoveredComponent, setHoveredComponent }}
    >
      {children}
    </ComponentPreviewContext.Provider>
  );
};

export const useComponentPreview = () => {
  const context = useContext(ComponentPreviewContext);
  if (!context) {
    throw new Error(
      "useComponentPreview must be used within ComponentPreviewProvider",
    );
  }
  return context;
};

