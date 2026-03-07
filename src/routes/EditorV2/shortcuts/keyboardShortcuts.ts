import type { ShortcutKeys } from "./shortcutUtils";

interface ShortcutDefinition {
  id: string;
  keys: ShortcutKeys;
  label: string;
  /** When true, the shortcut fires even when an input/textarea is focused. */
  allowInEditable?: boolean;
  action: (event: KeyboardEvent) => void;
}

const shortcuts: ShortcutDefinition[] = [];

export function registerShortcut(definition: ShortcutDefinition): () => void {
  shortcuts.push(definition);
  return () => {
    const index = shortcuts.indexOf(definition);
    if (index !== -1) shortcuts.splice(index, 1);
  };
}

export function getShortcuts(): readonly ShortcutDefinition[] {
  return shortcuts;
}
