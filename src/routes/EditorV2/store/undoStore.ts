import { action, computed, makeObservable, observable } from "mobx";
import type { UndoManager } from "mobx-keystone";
import { undoMiddleware, UndoStore as MobxUndoStore } from "mobx-keystone";

import type { ComponentSpec } from "@/models/componentSpec";

class UndoStore {
  @observable.ref accessor undoManager: UndoManager | null = null;

  constructor() {
    makeObservable(this);
  }

  @action init(spec: ComponentSpec, store?: MobxUndoStore) {
    this.dispose();
    this.undoManager = undoMiddleware(spec, store);
  }

  @action dispose() {
    if (this.undoManager) {
      this.undoManager.dispose();
      this.undoManager = null;
    }
  }

  undo() {
    if (this.undoManager?.canUndo) {
      this.undoManager.undo();
    }
  }

  redo() {
    if (this.undoManager?.canRedo) {
      this.undoManager.redo();
    }
  }

  @computed get canUndo(): boolean {
    return this.undoManager?.canUndo ?? false;
  }

  @computed get canRedo(): boolean {
    return this.undoManager?.canRedo ?? false;
  }

  @computed get undoLevels(): number {
    return this.undoManager?.undoLevels ?? 0;
  }

  @computed get redoLevels(): number {
    return this.undoManager?.redoLevels ?? 0;
  }

  clearHistory() {
    this.undoManager?.clearUndo();
    this.undoManager?.clearRedo();
  }
}

export const undoStore = new UndoStore();

/**
 * Like `withUndoGroup` but returns the value produced by `fn`.
 */
export function withUndoGroup<T = void>(label: string, fn: () => T): T {
  const manager = undoStore.undoManager;
  if (manager) {
    return manager.withGroup(label, fn);
  }
  return fn();
}
