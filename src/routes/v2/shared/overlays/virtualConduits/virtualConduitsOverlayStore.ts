import { action, makeObservable, observable } from "mobx";

/**
 * Toggles the auxiliary overlay that visualises derived virtual conduits
 * (grid channels) on top of the Editor canvas. Purely presentational and
 * pointer-transparent, so it never mutates pipeline state.
 */
class VirtualConduitsOverlayStore {
  @observable accessor active = false;

  constructor() {
    makeObservable(this);
  }

  @action setActive(value: boolean): void {
    this.active = value;
  }

  @action toggle(): void {
    this.active = !this.active;
  }

  @action reset(): void {
    this.active = false;
  }
}

export const virtualConduitsOverlayStore = new VirtualConduitsOverlayStore();
