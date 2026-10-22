import { action, computed, makeObservable, observable } from "mobx";
import type { UndoManager } from "mobx-keystone";
import { undoMiddleware } from "mobx-keystone";

import type { ComponentSpec } from "@/models/componentSpec";

export class UndoStore {
  @observable.ref accessor undoManager: UndoManager | null = null;

  private ownsManager = false;

  constructor() {
    makeObservable(this);
  }

  @action init(spec: ComponentSpec, manager?: UndoManager) {
    this.dispose();
    this.ownsManager = !manager;
    this.undoManager = manager ?? undoMiddleware(spec);
  }

  @action dispose() {
    if (this.undoManager) {
      if (this.ownsManager) this.undoManager.dispose();
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

  withGroup<T = void>(label: string, fn: () => T): T {
    if (this.undoManager) {
      return this.undoManager.withGroup(label, fn);
    }
    return fn();
  }
}
