/**
 * Todo: move this file to "persistence" layer.
 */
import Dexie, { type EntityTable } from "dexie";
import type { UndoEvent, UndoManager } from "mobx-keystone";
import { UndoStore } from "mobx-keystone";

const CURRENT_VERSION = 2;
const MAX_UNDO_EVENTS = 10;

interface StoredUndoHistory {
  pipelineName: string;
  version: number;
  idStack: string[];
  undoEvents: UndoEvent[];
}

const UndoHistoryDB = new Dexie("undo-history") as Dexie & {
  entries: EntityTable<StoredUndoHistory, "pipelineName">;
};

UndoHistoryDB.version(1).stores({
  entries: "pipelineName",
});

/**
 * Saves undo history for a pipeline.
 *
 * We deliberately avoid getSnapshot() here because it transforms
 * model snapshots embedded in patch values (wraps props in "$"),
 * which breaks redo when those patches are later applied.
 * Instead we deep-clone the raw events via JSON round-trip
 * to strip MobX observables while preserving the original format.
 */
export async function saveUndoHistory(
  pipelineName: string,
  idStack: string[],
  undoManager: UndoManager,
): Promise<void> {
  const rawEvents = undoManager.undoQueue.slice(-MAX_UNDO_EVENTS);
  const clonedEvents: UndoEvent[] = JSON.parse(JSON.stringify(rawEvents));

  await UndoHistoryDB.entries.put({
    pipelineName,
    version: CURRENT_VERSION,
    idStack,
    undoEvents: clonedEvents,
  });
}

export async function loadUndoHistory(
  pipelineName: string,
): Promise<StoredUndoHistory | null> {
  const data = await UndoHistoryDB.entries.get(pipelineName);

  if (!data) return null;
  if (data.version !== CURRENT_VERSION) return null;
  // An idStack alone is enough to replay stable `$id`s on load; undo events are
  // optional (a pipeline opened but never edited has none).
  if (!data.idStack?.length) return null;
  if (!data.undoEvents) return null;

  return data;
}

/**
 * Persists just the entity `$id` ordering for a pipeline, preserving any stored
 * undo events. Called when a spec is first loaded so `$id`s stay stable across
 * reloads even before the first edit — chat `entity://` links stay resolvable.
 */
export async function saveIdStack(
  pipelineName: string,
  idStack: string[],
): Promise<void> {
  const existing = await UndoHistoryDB.entries.get(pipelineName);
  await UndoHistoryDB.entries.put({
    pipelineName,
    version: CURRENT_VERSION,
    idStack,
    undoEvents: existing?.undoEvents ?? [],
  });
}

export function createUndoStoreWithEvents(events: UndoEvent[]): UndoStore {
  return new UndoStore({ undoEvents: events });
}
