import { useCallback, useRef } from "react";

import { useDebouncedState } from "./useDebouncedState";
import { useHistoryManager } from "./useHistoryManager";

interface UseUndoRedoOptions<M = Record<string, unknown>> {
  maxHistorySize?: number;
  debounceMs?: number;
  getMetadata?: () => M;
  onMetadataRestore?: (metadata: M) => void;
}

export interface UndoRedo {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

interface HistoryEntry<T, M = Record<string, unknown>> {
  state: T;
  metadata?: M;
}

export function useUndoRedo<T, M = Record<string, unknown>>(
  currentState: T,
  setState: (state: T) => void,
  options: UseUndoRedoOptions<M> = {},
): UndoRedo {
  const {
    maxHistorySize = 50,
    debounceMs = 500,
    getMetadata,
    onMetadataRestore,
  } = options;
  const isUndoRedoOperationRef = useRef(false);

  const historyManager = useHistoryManager<HistoryEntry<T, M>>({
    maxHistorySize,
  });

  const addToHistoryWithMetadata = useCallback(
    (state: T) => {
      const entry: HistoryEntry<T, M> = {
        state,
        metadata: getMetadata ? getMetadata() : undefined,
      };
      historyManager.addToHistory(entry);
    },
    [historyManager, getMetadata],
  );

  const { clearDebounce, updatePreviousState } = useDebouncedState(
    currentState,
    addToHistoryWithMetadata,
    () => isUndoRedoOperationRef.current,
    { debounceMs },
  );

  const undo = useCallback(() => {
    clearDebounce();

    if (historyManager.canUndo) {
      isUndoRedoOperationRef.current = true;
      try {
        const newIndex = historyManager.currentIndex - 1;
        const previousEntry = historyManager.navigateToIndex(newIndex);

        if (previousEntry) {
          setState(previousEntry.state);
          updatePreviousState(previousEntry.state);

          if (previousEntry.metadata && onMetadataRestore) {
            try {
              onMetadataRestore(previousEntry.metadata);
            } catch (error) {
              console.warn("Failed to restore metadata during undo:", error);
            }
          }
        }
      } finally {
        isUndoRedoOperationRef.current = false;
      }
    }
  }, [
    historyManager,
    setState,
    clearDebounce,
    updatePreviousState,
    onMetadataRestore,
  ]);

  const redo = useCallback(() => {
    clearDebounce();

    if (historyManager.canRedo) {
      isUndoRedoOperationRef.current = true;
      try {
        const newIndex = historyManager.currentIndex + 1;
        const nextEntry = historyManager.navigateToIndex(newIndex);

        if (nextEntry) {
          setState(nextEntry.state);
          updatePreviousState(nextEntry.state);

          if (nextEntry.metadata && onMetadataRestore) {
            try {
              onMetadataRestore(nextEntry.metadata);
            } catch (error) {
              console.warn("Failed to restore metadata during redo:", error);
            }
          }
        }
      } finally {
        isUndoRedoOperationRef.current = false;
      }
    }
  }, [
    historyManager,
    setState,
    clearDebounce,
    updatePreviousState,
    onMetadataRestore,
  ]);

  const clearHistory = useCallback(() => {
    clearDebounce();
    historyManager.clearHistory();
    updatePreviousState(currentState);
  }, [historyManager, clearDebounce, updatePreviousState, currentState]);

  return {
    undo,
    redo,
    canUndo: historyManager.canUndo,
    canRedo: historyManager.canRedo,
    clearHistory,
  };
}
