import { createContext, type ReactNode, useState } from "react";

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
