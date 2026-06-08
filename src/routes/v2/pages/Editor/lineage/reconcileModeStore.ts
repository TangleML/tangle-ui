import { action, computed, makeObservable, observable } from "mobx";

import type { ReconcileSession } from "./reconcileSession";

/**
 * Tracks whether the editor is in cross-pipeline "reconcile mode" — driven by
 * the `?reconcile=<id>` URL param via {@link useReconcileFromUrl}. When active,
 * the canvas stages the edited component on matching tasks (autosave held), the
 * UI focuses on reconciling (chrome hidden), and navigation is guarded.
 */
class ReconcileModeStore {
  @observable accessor session: ReconcileSession | null = null;
  /** The task node id currently shown with the Mark Done button. Updated by
   * ReconcileModeController on staging and on each goTo() navigation. Used by
   * FlowCanvas to temporarily boost that node's zIndex above all others. */
  @observable accessor currentReconcileTaskId: string | null = null;

  constructor() {
    makeObservable(this);
  }

  @computed
  get active(): boolean {
    return this.session !== null;
  }

  @action
  enter(session: ReconcileSession): void {
    this.session = session;
  }

  @action
  exit(): void {
    this.session = null;
    this.currentReconcileTaskId = null;
  }

  @action
  setCurrentReconcileTaskId(id: string | null): void {
    this.currentReconcileTaskId = id;
  }
}

export const reconcileModeStore = new ReconcileModeStore();
