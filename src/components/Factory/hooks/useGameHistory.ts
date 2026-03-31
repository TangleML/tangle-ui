import { useRef } from "react";

const MAX_STACK_SIZE = 30;

interface GameHistory<T> {
  pushUndo: (snapshot: T) => void;
  popUndo: () => T | null;
  pushRedo: (snapshot: T) => void;
  popRedo: () => T | null;
  clearRedo: () => void;
  clearAll: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export function useGameHistory<T>(): GameHistory<T> {
  const undoStackRef = useRef<T[]>([]);
  const redoStackRef = useRef<T[]>([]);

  const pushUndo = (snapshot: T) => {
    undoStackRef.current.push(structuredClone(snapshot));
    if (undoStackRef.current.length > MAX_STACK_SIZE) {
      undoStackRef.current.shift();
    }
  };

  const popUndo = (): T | null => {
    const entry = undoStackRef.current.pop();
    return entry ?? null;
  };

  const pushRedo = (snapshot: T) => {
    redoStackRef.current.push(structuredClone(snapshot));
    if (redoStackRef.current.length > MAX_STACK_SIZE) {
      redoStackRef.current.shift();
    }
  };

  const popRedo = (): T | null => {
    const entry = redoStackRef.current.pop();
    return entry ?? null;
  };

  const clearRedo = () => {
    redoStackRef.current = [];
  };

  const clearAll = () => {
    undoStackRef.current = [];
    redoStackRef.current = [];
  };

  const canUndo = () => undoStackRef.current.length > 0;
  const canRedo = () => redoStackRef.current.length > 0;

  return {
    pushUndo,
    popUndo,
    pushRedo,
    popRedo,
    clearRedo,
    clearAll,
    canUndo,
    canRedo,
  };
}
