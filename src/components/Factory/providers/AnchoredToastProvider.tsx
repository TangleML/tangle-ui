import {
  createContext,
  type FC,
  type ReactNode,
  type RefObject,
  useContext,
  useState,
} from "react";

interface Toast {
  id: string;
  anchorRef: RefObject<HTMLElement | null>;
  content: ReactNode;
  createdAt: number;
  duration?: number;
}

interface AnchoredToastContextType {
  toasts: Toast[];
  addToast: (
    anchorRef: RefObject<HTMLElement | null>,
    content: ReactNode,
    duration?: number,
  ) => void;
  removeToast: (id: string) => void;
}

const AnchoredToastContext = createContext<
  AnchoredToastContextType | undefined
>(undefined);

export const AnchoredToastProvider: FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (
    anchorRef: RefObject<HTMLElement | null>,
    content: ReactNode,
    duration = 2500,
  ) => {
    const id = `${Date.now()}-${Math.random()}`;
    const toast: Toast = {
      id,
      anchorRef,
      content,
      createdAt: Date.now(),
      duration,
    };

    setToasts((prev) => [...prev, toast]);

    // Auto-remove after animation duration
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <AnchoredToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </AnchoredToastContext.Provider>
  );
};

export const useAnchoredToast = () => {
  const context = useContext(AnchoredToastContext);
  if (!context) {
    throw new Error(
      "useAnchoredToast must be used within AnchoredToastProvider",
    );
  }
  return context;
};
