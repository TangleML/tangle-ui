import { action, computed, makeObservable, observable } from "mobx";

import type { CanvasOverlayConfig } from "./canvasOverlay.types";

export class CanvasOverlayStore {
  @observable accessor overlayStack: CanvasOverlayConfig[] = [];

  constructor() {
    makeObservable(this);
  }

  /** The topmost overlay in the stack, or `null` when empty. */
  @computed get activeOverlay(): CanvasOverlayConfig | null {
    return this.overlayStack.at(-1) ?? null;
  }

  @computed get isActive(): boolean {
    return this.activeOverlay !== null;
  }

  @computed get activeOverlayId(): string | null {
    return this.activeOverlay?.id ?? null;
  }

  /**
   * Push an overlay onto the stack. If an overlay with the same id already
   * exists, it is replaced in place (preserving its position).
   */
  @action activate(config: CanvasOverlayConfig): void {
    const idx = this.overlayStack.findIndex((o) => o.id === config.id);
    if (idx !== -1) {
      this.overlayStack[idx] = config;
    } else {
      this.overlayStack.push(config);
    }
  }

  /** Remove all overlays from the stack. */
  @action deactivate(): void {
    this.overlayStack.length = 0;
  }

  /** Remove a specific overlay by id (regardless of position). */
  @action deactivateById(id: string): void {
    const idx = this.overlayStack.findIndex((o) => o.id === id);
    if (idx !== -1) {
      this.overlayStack.splice(idx, 1);
    }
  }
}
