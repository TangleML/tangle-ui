/**
 * Lightweight plugin system for dock area lifecycle events.
 *
 * The window store emits generic events at key mutation points.
 * Plugins register for a specific dock area side and react to events
 * without the store needing any knowledge of plugin behavior.
 */

export type DockAreaEventType =
  | "window-docked"
  | "window-expanded"
  | "window-closing"
  | "window-minimized";

export interface DockAreaEvent {
  type: DockAreaEventType;
  side: "left" | "right";
  windowId: string;
}

type DockAreaPlugin = (event: DockAreaEvent) => void;

const plugins = new Map<string, DockAreaPlugin[]>();

/** Register a plugin for a specific dock area side. Returns an unsubscribe function. */
export function registerDockAreaPlugin(
  side: "left" | "right",
  plugin: DockAreaPlugin,
): () => void {
  const list = plugins.get(side) ?? [];
  list.push(plugin);
  plugins.set(side, list);

  return () => {
    const current = plugins.get(side);
    if (!current) return;
    const idx = current.indexOf(plugin);
    if (idx !== -1) current.splice(idx, 1);
  };
}

/** Emit an event to all plugins registered for the given side. */
export function emitDockAreaEvent(event: DockAreaEvent): void {
  const list = plugins.get(event.side);
  if (!list) return;
  for (const plugin of list) {
    plugin(event);
  }
}
