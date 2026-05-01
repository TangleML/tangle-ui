import { action, computed, makeObservable, observable } from "mobx";

import { emitDockAreaEvent } from "./dockAreaPlugins";
import {
  DEFAULT_DOCKED_HEIGHT,
  type DockState,
  isDockSide,
  MIN_DOCKED_HEIGHT,
  type Position,
  type Size,
  type WindowAction,
  type WindowState,
} from "./types";

/**
 * Minimal store interface used by WindowModel for collection-level operations.
 * Defined here to avoid circular runtime imports between windowModel.ts and windowStore.ts.
 */
export interface WindowStoreRef {
  closeWindow(id: string): void;
  bringToFront(id: string): void;
  dockWindow(id: string, side: DockState, insertIndex?: number): void;
  undockWindow(id: string): void;
  isDockAreaCollapsed(side: DockState): boolean;
  isWindowAtFront(id: string): boolean;
  getWindowZIndex(id: string): number;
}

export interface WindowModelInit {
  id: string;
  title: string;
  state: WindowState;
  position: Position;
  size: Size;
  minSize: Size;
  previousPosition?: Position;
  previousSize?: Size;
  previousState?: WindowState;
  preDockedPosition?: Position;
  preDockedSize?: Size;
  linkedEntityId?: string;
  disabledActions?: WindowAction[];
  dockedHeight?: number;
  dockState: DockState;
  persisted: boolean;
  autoSize?: boolean;
  onClose?: () => void;
}

/**
 * Per-window observable model. Encapsulates all state and actions for a single
 * window, delegating collection-level operations to the parent store via
 * the {@link WindowStoreRef} interface.
 */
export class WindowModel {
  readonly id: string;
  @observable accessor title: string;
  @observable accessor state: WindowState;
  @observable accessor position: Position;
  @observable accessor size: Size;
  @observable accessor minSize: Size;
  @observable accessor previousPosition: Position | undefined;
  @observable accessor previousSize: Size | undefined;
  @observable accessor previousState: WindowState | undefined;
  @observable accessor preDockedPosition: Position | undefined;
  @observable accessor preDockedSize: Size | undefined;
  @observable accessor linkedEntityId: string | undefined;
  @observable accessor disabledActions: WindowAction[] | undefined;
  @observable accessor dockedHeight: number | undefined;
  @observable accessor dockState: DockState;
  @observable accessor persisted: boolean;
  @observable accessor autoSize: boolean;

  readonly onClose: (() => void) | undefined;
  private readonly store: WindowStoreRef;

  constructor(init: WindowModelInit, store: WindowStoreRef) {
    this.id = init.id;
    this.title = init.title;
    this.state = init.state;
    this.position = init.position;
    this.size = init.size;
    this.minSize = init.minSize;
    this.previousPosition = init.previousPosition;
    this.previousSize = init.previousSize;
    this.previousState = init.previousState;
    this.preDockedPosition = init.preDockedPosition;
    this.preDockedSize = init.preDockedSize;
    this.linkedEntityId = init.linkedEntityId;
    this.disabledActions = init.disabledActions;
    this.dockedHeight = init.dockedHeight;
    this.dockState = init.dockState;
    this.persisted = init.persisted;
    this.autoSize = init.autoSize ?? false;
    this.onClose = init.onClose;
    this.store = store;
    makeObservable(this);
  }

  // -- Computed getters --

  @computed get isMinimized(): boolean {
    return this.state === "minimized";
  }

  @computed get isMaximized(): boolean {
    return this.state === "maximized";
  }

  @computed get isDocked(): boolean {
    return this.dockState !== "none";
  }

  @computed get dockAreaCollapsed(): boolean {
    return this.store.isDockAreaCollapsed(this.dockState);
  }

  @computed get isAtFront(): boolean {
    return this.store.isWindowAtFront(this.id);
  }

  @computed get zIndex(): number {
    return this.store.getWindowZIndex(this.id);
  }

  @computed get effectiveDockedHeight(): number {
    return this.dockedHeight ?? DEFAULT_DOCKED_HEIGHT;
  }

  isActionDisabled(actionType: WindowAction): boolean {
    return this.disabledActions?.includes(actionType) ?? false;
  }

  // -- State mutation actions --

  @action minimize({ quiet = false } = {}): void {
    if (this.isMinimized) return;
    this.saveSnapshot();
    this.state = "minimized";
    if (!quiet && this.isDocked && isDockSide(this.dockState)) {
      emitDockAreaEvent({
        type: "window-minimized",
        side: this.dockState,
        windowId: this.id,
      });
    }
  }

  @action maximize(): void {
    if (this.isMaximized) return;
    this.saveSnapshot();
    this.state = "maximized";
    this.store.bringToFront(this.id);
  }

  @action hide(): void {
    if (this.state === "hidden") return;
    this.saveSnapshot();
    this.state = "hidden";
  }

  @action restore({ quiet = false } = {}): void {
    const wasHidden = this.state === "hidden";
    const wasMinimized = this.isMinimized;
    const wasDocked = this.isDocked;

    this.restoreSnapshot();

    if (!quiet) {
      this.store.bringToFront(this.id);
    }

    if (
      !quiet &&
      wasDocked &&
      (wasMinimized || wasHidden) &&
      isDockSide(this.dockState)
    ) {
      emitDockAreaEvent({
        type: "window-expanded",
        side: this.dockState,
        windowId: this.id,
      });
    }
  }

  @action toggleMinimize(): void {
    if (this.isMinimized) {
      this.restore();
    } else {
      this.minimize();
    }
  }

  @action toggleMaximize(): void {
    if (this.isMaximized) {
      this.restore();
    } else {
      this.maximize();
    }
  }

  close(): void {
    this.store.closeWindow(this.id);
  }

  bringToFront(): void {
    this.store.bringToFront(this.id);
  }

  @action updatePosition(pos: Position): void {
    this.position = pos;
  }

  @action updateSize(newSize: Size): void {
    this.size = newSize;
  }

  @action disableAutoSize(): void {
    this.autoSize = false;
  }

  @action updateDockedHeight(height: number): void {
    this.dockedHeight = Math.max(MIN_DOCKED_HEIGHT, height);
  }

  dock(side: DockState, insertIndex?: number): void {
    this.store.dockWindow(this.id, side, insertIndex);
  }

  undock(): void {
    this.store.undockWindow(this.id);
  }

  // -- Docking state helpers (called by the store during dock/undock) --

  @action savePreDockedState(): void {
    if (this.dockState === "none") {
      this.preDockedPosition = { ...this.position };
      this.preDockedSize = { ...this.size };
    }
  }

  @action applyDockState(side: Exclude<DockState, "none">): void {
    this.dockState = side;
    this.dockedHeight = this.dockedHeight ?? DEFAULT_DOCKED_HEIGHT;
  }

  @action applyUndockState(): void {
    if (this.preDockedPosition) this.position = { ...this.preDockedPosition };
    if (this.preDockedSize) this.size = { ...this.preDockedSize };
    this.dockState = "none";
    this.preDockedPosition = undefined;
    this.preDockedSize = undefined;
    // Floating windows don't render a minimized state; normalize on undock.
    if (this.state === "minimized") this.state = "normal";
  }

  // -- Snapshot helpers (save/restore for minimize/maximize/hide transitions) --

  @action private saveSnapshot(): void {
    this.previousState = this.state;
    this.previousPosition = { ...this.position };
    this.previousSize = { ...this.size };
  }

  @action private restoreSnapshot(): void {
    this.state =
      this.previousState === "maximized"
        ? "normal"
        : (this.previousState ?? "normal");
    if (this.previousPosition) this.position = { ...this.previousPosition };
    if (this.previousSize) this.size = { ...this.previousSize };
    this.previousState = undefined;
    this.previousPosition = undefined;
    this.previousSize = undefined;
  }

  /** Serialization for JSON.stringify() and MobX change tracking. */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      title: this.title,
      state: this.state,
      position: this.position,
      size: this.size,
      minSize: this.minSize,
      dockState: this.dockState,
      dockedHeight: this.dockedHeight,
      persisted: this.persisted,
      linkedEntityId: this.linkedEntityId,
      previousPosition: this.previousPosition,
      previousSize: this.previousSize,
      previousState: this.previousState,
      preDockedPosition: this.preDockedPosition,
      preDockedSize: this.preDockedSize,
    };
  }
}
