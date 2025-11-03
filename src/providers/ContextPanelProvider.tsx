import { useReactFlow } from "@xyflow/react";
import { type ReactNode, useEffect, useEffectEvent, useState } from "react";

import { deselectAllNodes } from "@/utils/flowUtils";

import {
  createRequiredContext,
  useRequiredContext,
} from "../hooks/useRequiredContext";

type ContextPanelContextType = {
  content: ReactNode;
  setContent: (content: ReactNode) => void;
  clearContent: () => void;
};

const ContextPanelContext = createRequiredContext<ContextPanelContextType>(
  "ContextPanelProvider",
);

const EMPTY_STATE = (
  <div className="flex items-center justify-center h-full">
    <p className="text-gray-500">Select an element to see details</p>
  </div>
);

export const ContextPanelProvider = ({
  defaultContent = EMPTY_STATE,
  children,
}: {
  defaultContent?: ReactNode;
  children: ReactNode;
}) => {
  const { setNodes } = useReactFlow();
  const [content, setContentState] = useState<ReactNode>(defaultContent);

  const setContent = (content: ReactNode) => {
    setContentState(content);
  };

  const clearContent = () => {
    setContentState(defaultContent);
  };

  const onEscapeKey = useEffectEvent(() => {
    clearContent();
    setNodes(deselectAllNodes);
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscapeKey();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const value = { content, setContent, clearContent };

  return (
    <ContextPanelContext.Provider value={value}>
      {children}
    </ContextPanelContext.Provider>
  );
};

export const useContextPanel = () => {
  return useRequiredContext(ContextPanelContext);
};
