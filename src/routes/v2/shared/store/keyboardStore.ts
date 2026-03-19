import { action, makeObservable, observable } from "mobx";

import type { KeyConstant } from "@/routes/v2/shared/shortcuts/keys";
import { normalizeComboKey } from "@/routes/v2/shared/shortcuts/keys";

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
  pressed = observable.set<KeyConstant>();
  shortcuts = observable.map<string, ShortcutDefinition>();

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
