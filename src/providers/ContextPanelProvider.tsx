import { useReactFlow } from "@xyflow/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { deselectAllNodes } from "@/utils/flowUtils";

import {
  createRequiredContext,
  useRequiredContext,
} from "../hooks/useRequiredContext";

type ContextPanelContextType = {
  content: ReactNode;
  open: boolean;
  setContent: (content: ReactNode) => void;
  clearContent: () => void;
  setOpen: (open: boolean) => void;
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
  const defaultContentRef = useRef<ReactNode>(defaultContent);
  const [content, setContentState] = useState<ReactNode>(defaultContent);
  const [open, setOpen] = useState(true);

  const setContent = useCallback((content: ReactNode) => {
    setContentState(content);
  }, []);

  const clearContent = useCallback(() => {
    setContentState(defaultContentRef.current);
  }, []);

  useEffect(() => {
    defaultContentRef.current = defaultContent;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearContent();
        setNodes(deselectAllNodes);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [defaultContent]);

  const value = useMemo(
    () => ({ content, open, setContent, clearContent, setOpen }),
    [content, open, setContent, clearContent, setOpen],
  );

  return (
    <ContextPanelContext.Provider value={value}>
      {children}
    </ContextPanelContext.Provider>
  );
};

export const useContextPanel = () => {
  return useRequiredContext(ContextPanelContext);
};
