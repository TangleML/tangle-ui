import { action, makeObservable, observable } from "mobx";
import type { UndoManager } from "mobx-keystone";
import { undoMiddleware, UndoStore as MobxUndoStore } from "mobx-keystone";

import type { ComponentSpec } from "@/models/componentSpec";

class UndoStore {
  undoManager: UndoManager | null = null;

  constructor() {
    makeObservable(this, {
      undoManager: observable.ref,
      init: action,
      dispose: action,
    });
  }

  init(spec: ComponentSpec, store?: MobxUndoStore) {
    this.dispose();
    this.undoManager = undoMiddleware(spec, store);
  }

  dispose() {
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

  get canUndo(): boolean {
    return this.undoManager?.canUndo ?? false;
  }

  get canRedo(): boolean {
    return this.undoManager?.canRedo ?? false;
  }

  get undoLevels(): number {
    return this.undoManager?.undoLevels ?? 0;
  }

  get redoLevels(): number {
    return this.undoManager?.redoLevels ?? 0;
  }

  clearHistory() {
    this.undoManager?.clearUndo();
    this.undoManager?.clearRedo();
  }
}

export const undoStore = new UndoStore();
