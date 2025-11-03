import { useRef } from "react";

import { deepClone } from "@/utils/deepClone";

import { useDebouncedState } from "./useDebouncedState";
import { useHistoryManager } from "./useHistoryManager";

interface UseUndoRedoOptions {
  maxHistorySize?: number;
  debounceMs?: number;
}

export interface UndoRedo {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

export function useUndoRedo<T>(
  currentState: T,
  setState: (state: T) => void,
  options: UseUndoRedoOptions = {},
): UndoRedo {
  const { maxHistorySize = 50, debounceMs = 500 } = options;
  const isUndoRedoOperationRef = useRef(false);

  const historyManager = useHistoryManager<T>({ maxHistorySize });

  const { clearDebounce, updatePreviousState } = useDebouncedState(
    currentState,
    historyManager.addToHistory,
    () => isUndoRedoOperationRef.current,
    { debounceMs },
  );

  const undo = () => {
    clearDebounce();

    if (historyManager.canUndo) {
      isUndoRedoOperationRef.current = true;
      const newIndex = historyManager.currentIndex - 1;
      const previousState = historyManager.navigateToIndex(newIndex);

      if (previousState) {
        setState(deepClone(previousState));
        updatePreviousState(previousState);
      }

      isUndoRedoOperationRef.current = false;
    }
  };

  const redo = () => {
    clearDebounce();

    if (historyManager.canRedo) {
      isUndoRedoOperationRef.current = true;
      const newIndex = historyManager.currentIndex + 1;
      const nextState = historyManager.navigateToIndex(newIndex);

      if (nextState) {
        setState(deepClone(nextState));
        updatePreviousState(nextState);
      }

      isUndoRedoOperationRef.current = false;
    }
  };

  const clearHistory = () => {
    clearDebounce();
    historyManager.clearHistory();
    updatePreviousState(currentState);
  };

  return {
    undo,
    redo,
    canUndo: historyManager.canUndo,
    canRedo: historyManager.canRedo,
    clearHistory,
  };
}
