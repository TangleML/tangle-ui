import { action, makeObservable, observable } from "mobx";

import type { KeyConstant } from "../shortcuts/keys";
import { normalizeComboKey } from "../shortcuts/keys";

export type ShortcutKeys = KeyConstant[];

export interface ShortcutDefinition {
  id: string;
  keys: ShortcutKeys;
  label: string;
  /** When true, the shortcut fires even when an input/textarea is focused. */
  allowInEditable?: boolean;
  // todo: add DOM element as a scope for the shortcut
  // todo: add enabled: boolean;
  action: (event: KeyboardEvent) => void;
}

class KeyboardStore {
  pressed = observable.set<KeyConstant>();
  shortcuts = observable.map<string, ShortcutDefinition>();

  constructor() {
    makeObservable(this, {
      pressKey: action,
      releaseKey: action,
      clearPressed: action,
    });
  }

  pressKey(key: KeyConstant) {
    this.pressed.add(key);
  }

  releaseKey(key: KeyConstant) {
    this.pressed.delete(key);
  }

  clearPressed() {
    this.pressed.clear();
  }

  registerShortcut(definition: ShortcutDefinition): () => void {
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
}

export const keyboardStore = new KeyboardStore();

export function registerShortcut(definition: ShortcutDefinition): () => void {
  return keyboardStore.registerShortcut(definition);
}
