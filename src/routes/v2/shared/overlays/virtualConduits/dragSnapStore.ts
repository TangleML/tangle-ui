import { action, makeObservable, observable } from "mobx";

/**
 * Holds the active alignment guide lines while a node drag is in progress.
 * Populated by the drag interceptor and read by the virtual conduits overlay
 * to draw the magnetic snap guides. Cleared the moment the drag ends, so it is
 * independent of the "Show virtual conduits" toggle.
 */
class DragSnapStore {
  @observable.ref accessor verticalGuides: number[] = [];
  @observable.ref accessor horizontalGuides: number[] = [];

  constructor() {
    makeObservable(this);
  }

  @action setGuides(vertical: number[], horizontal: number[]): void {
    this.verticalGuides = vertical;
    this.horizontalGuides = horizontal;
  }

  @action clear(): void {
    if (this.verticalGuides.length === 0 && this.horizontalGuides.length === 0)
      return;
    this.verticalGuides = [];
    this.horizontalGuides = [];
  }
}

export const dragSnapStore = new DragSnapStore();
