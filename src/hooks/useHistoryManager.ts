import { useState } from "react";

import { deepClone } from "@/utils/deepClone";

interface UseHistoryManagerOptions {
  maxHistorySize?: number;
}

interface HistoryManager<T> {
  history: T[];
  currentIndex: number;
  addToHistory: (state: T) => void;
  navigateToIndex: (index: number) => T | null;
  clearHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistoryManager<T>(
  options: UseHistoryManagerOptions = {},
): HistoryManager<T> {
  const { maxHistorySize = 50 } = options;

  const [history, setHistory] = useState<T[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const addToHistory = (state: T) => {
    setHistory((prevHistory) => {
      let newHistory = [...prevHistory];
      if (currentIndex < newHistory.length - 1) {
        newHistory = newHistory.slice(0, currentIndex + 1);
      }

      newHistory.push(deepClone(state));

      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        setCurrentIndex(newHistory.length - 2);
      } else {
        setCurrentIndex(newHistory.length - 1);
      }

      return newHistory;
    });
  };

  const navigateToIndex = (index: number): T | null => {
    if (index >= 0 && index < history.length) {
      setCurrentIndex(index);
      return deepClone(history[index]);
    }
    return null;
  };

  const clearHistory = () => {
    setHistory([]);
    setCurrentIndex(-1);
  };

  const canUndo = currentIndex > 0;

  const canRedo = currentIndex < history.length - 1;

  return {
    history,
    currentIndex,
    addToHistory,
    navigateToIndex,
    clearHistory,
    canUndo,
    canRedo,
  };
}
