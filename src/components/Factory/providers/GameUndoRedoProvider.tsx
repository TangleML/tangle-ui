import type { Edge, Node } from "@xyflow/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react";

import type { GlobalResources } from "../data/resources";
import { useGameHistory } from "../hooks/useGameHistory";

interface GameSnapshot {
  nodes: Node[];
  edges: Edge[];
  resources: GlobalResources;
}

type StateGetter = () => GameSnapshot;
type RestoreHandler = (snapshot: GameSnapshot) => void;

interface GameUndoRedoContextType {
  takeSnapshot: (
    nodes: Node[],
    edges: Edge[],
    resources: GlobalResources,
  ) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;
  registerStateAccessor: (getter: StateGetter) => void;
  registerRestoreHandler: (handler: RestoreHandler) => void;
}

const GameUndoRedoContext = createContext<GameUndoRedoContextType | undefined>(
  undefined,
);

export const GameUndoRedoProvider = ({ children }: { children: ReactNode }) => {
  const history = useGameHistory<GameSnapshot>();
  const stateGetterRef = useRef<StateGetter | null>(null);
  const restoreHandlerRef = useRef<RestoreHandler | null>(null);
  const [undoRedoState, setUndoRedoState] = useState({
    canUndo: false,
    canRedo: false,
  });

  const syncState = () => {
    setUndoRedoState({
      canUndo: history.canUndo(),
      canRedo: history.canRedo(),
    });
  };

  const registerStateAccessor = (getter: StateGetter) => {
    stateGetterRef.current = getter;
  };

  const registerRestoreHandler = (handler: RestoreHandler) => {
    restoreHandlerRef.current = handler;
  };

  const takeSnapshot = (
    nodes: Node[],
    edges: Edge[],
    resources: GlobalResources,
  ) => {
    history.pushUndo({ nodes, edges, resources });
    history.clearRedo();
    syncState();
  };

  const undo = () => {
    const currentState = stateGetterRef.current?.();
    if (!currentState) return;

    const previousState = history.popUndo();
    if (!previousState) return;

    history.pushRedo(currentState);
    restoreHandlerRef.current?.(previousState);
    syncState();
  };

  const redo = () => {
    const currentState = stateGetterRef.current?.();
    if (!currentState) return;

    const nextState = history.popRedo();
    if (!nextState) return;

    history.pushUndo(currentState);
    restoreHandlerRef.current?.(nextState);
    syncState();
  };

  const clearHistory = () => {
    history.clearAll();
    syncState();
  };

  return (
    <GameUndoRedoContext.Provider
      value={{
        takeSnapshot,
        undo,
        redo,
        clearHistory,
        canUndo: undoRedoState.canUndo,
        canRedo: undoRedoState.canRedo,
        registerStateAccessor,
        registerRestoreHandler,
      }}
    >
      {children}
    </GameUndoRedoContext.Provider>
  );
};

export function useGameUndoRedo(): GameUndoRedoContextType {
  const context = useContext(GameUndoRedoContext);
  if (!context) {
    throw new Error(
      "useGameUndoRedo must be used within a GameUndoRedoProvider",
    );
  }
  return context;
}
