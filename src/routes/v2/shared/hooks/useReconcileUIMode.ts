import { action, makeObservable, observable } from "mobx";

/**
 * Shared-layer store that tracks whether the editor is in reconcile UI mode
 * (focused canvas, limited chrome). Lives in the shared layer so both:
 *   - DockArea (shared/windows) — to gate which panels are visible
 *   - useReconcileFromUrl (pages/Editor/lineage) — to set/clear the flag
 * can access it without violating the pages → shared dependency direction.
 */
class ReconcileUIModeStore {
  @observable accessor active = false;

  constructor() {
    makeObservable(this);
  }

  @action setActive(value: boolean): void {
    this.active = value;
  }
}

export const reconcileUIModeStore = new ReconcileUIModeStore();
