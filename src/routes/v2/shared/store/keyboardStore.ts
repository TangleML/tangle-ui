import { action, computed, makeObservable, observable } from "mobx";

import {
  CMD_OR_CTRL,
  CTRL,
  IS_MAC,
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
  // When true, the shortcut fires even when an input/textarea is focused.
  allowInEditable?: boolean;
  // todo: add DOM element as a scope for the shortcut
  // todo: add enabled: boolean;
  // Return `false` to allow the native event to propagate:
  // the listener skips preventDefault so the
  // browser / Radix portal handlers (e.g. dialog ESC) can run.
  // The shortcut registry holds at most one handler per combo,
  // so this is NOT a fallthrough to another shortcut.
  action: (event: KeyboardEvent, params?: ShortcutParams) => void | false;
}

export class KeyboardStore {
  readonly isMac: boolean;

  @observable.ref accessor pressed = observable.set<KeyConstant>();
  @observable.ref accessor shortcuts = observable.map<
    string,
    ShortcutDefinition
  >();

  @observable accessor listening = false;

  constructor({ isMac = IS_MAC }: { isMac?: boolean } = {}) {
    this.isMac = isMac;
    makeObservable(this);
  }

  @action setListening(value: boolean) {
    this.listening = value;
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
    toggle(this.isPrimaryModifierHeld(event), CMD_OR_CTRL);
    toggle(this.isMac && event.ctrlKey, CTRL);
    toggle(event.shiftKey, SHIFT);
  }

  isPrimaryModifierHeld(event: KeyboardEvent): boolean {
    return this.isMac ? event.metaKey : event.ctrlKey;
  }

  @action clearNonModifierKeys() {
    for (const key of this.pressed) {
      if (key !== CMD_OR_CTRL && key !== CTRL && key !== SHIFT) {
        this.pressed.delete(key);
      }
    }
  }

  @action registerShortcut(definition: ShortcutDefinition): () => void {
    const registered = {
      ...definition,
      keys: this.toPlatformKeys(definition.keys),
    };
    const comboKey = normalizeComboKey(registered.keys);
    this.shortcuts.set(comboKey, registered);
    return () => {
      const current = this.shortcuts.get(comboKey);
      if (current === registered) {
        this.shortcuts.delete(comboKey);
      }
    };
  }

  private toPlatformKeys(keys: ShortcutKeys): ShortcutKeys {
    if (this.isMac) return keys;
    return keys.map((key) => (key === CTRL ? CMD_OR_CTRL : key));
  }

  @computed get pressedKeys(): KeyConstant[] {
    return Array.from(this.pressed.values());
  }

  getShortcut(id: string): ShortcutDefinition | undefined {
    return [...this.shortcuts.values()].find((shortcut) => shortcut.id === id);
  }

  matchesPressed(keys: ShortcutKeys): boolean {
    if (this.pressed.size !== keys.length) return false;
    return keys.every((k) => this.pressed.has(k));
  }

  invokeShortcut(id: string, params?: ShortcutParams): void {
    const shortcut = this.getShortcut(id);
    shortcut?.action(new KeyboardEvent("keydown"), params);
  }
}
