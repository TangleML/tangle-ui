import { action, makeObservable, observable } from "mobx";

import {
  CMDALT,
  CTRL,
  type KeyConstant,
  normalizeComboKey,
  SHIFT,
} from "@/routes/v2/shared/shortcuts/keys";

type ShortcutKeys = KeyConstant[];

type ShortcutParams = Record<string, unknown>;

interface ShortcutDefinition {
  id: string;
  keys: ShortcutKeys;
  label: string;
  /** When true, the shortcut fires even when an input/textarea is focused. */
  allowInEditable?: boolean;
  // todo: add DOM element as a scope for the shortcut
  // todo: add enabled: boolean;
  action: (event: KeyboardEvent, params?: ShortcutParams) => void;
}

export class KeyboardStore {
  @observable.ref accessor pressed = observable.set<KeyConstant>();
  @observable.ref accessor shortcuts = observable.map<
    string,
    ShortcutDefinition
  >();

  constructor() {
    makeObservable(this);
  }

  @action pressKey(key: KeyConstant) {
    this.pressed.add(key);
  }

  @action releaseKey(key: KeyConstant) {
    this.pressed.delete(key);
  }

  @action clearPressed() {
    this.pressed.clear();
  }

  /**
   * Reconcile modifier keys in `pressed` with the actual event state.
   * Ensures modifiers are restored after `clearPressed()` and stay
   * accurate even when macOS swallows keyup events.
   */
  @action syncModifiers(event: KeyboardEvent) {
    const toggle = (flag: boolean, key: KeyConstant) => {
      if (flag) this.pressed.add(key);
      else this.pressed.delete(key);
    };
    toggle(event.metaKey || event.altKey, CMDALT);
    toggle(event.ctrlKey, CTRL);
    toggle(event.shiftKey, SHIFT);
  }

  @action clearNonModifierKeys() {
    for (const key of this.pressed) {
      if (key !== CMDALT && key !== CTRL && key !== SHIFT) {
        this.pressed.delete(key);
      }
    }
  }

  @action registerShortcut(definition: ShortcutDefinition): () => void {
    const comboKey = normalizeComboKey(definition.keys);
    this.shortcuts.set(comboKey, definition);
    return () => {
      const current = this.shortcuts.get(comboKey);
      if (current === definition) {
        this.shortcuts.delete(comboKey);
      }
    };
  }

  getShortcut(id: string): ShortcutDefinition | undefined {
    return [...this.shortcuts.values()].find((shortcut) => shortcut.id === id);
  }

  /**
   * Returns true when the pressed set matches the given shortcut keys exactly.
   */
  matchesPressed(keys: ShortcutKeys): boolean {
    if (this.pressed.size !== keys.length) return false;
    return keys.every((k) => this.pressed.has(k));
  }

  /**
   * Programmatically invoke a registered shortcut by id with optional params.
   */
  invokeShortcut(id: string, params?: ShortcutParams): void {
    const shortcut = this.getShortcut(id);
    shortcut?.action(new KeyboardEvent("keydown"), params);
  }
}
