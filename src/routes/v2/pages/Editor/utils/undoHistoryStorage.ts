/**
 * Todo: move this file to "persistence" layer.
 */
import Dexie, { type EntityTable } from "dexie";
import type { UndoEvent, UndoManager } from "mobx-keystone";
import { UndoStore } from "mobx-keystone";

const CURRENT_VERSION = 2;
const MAX_UNDO_EVENTS = 10;

interface StoredUndoHistory {
  fileId: string;
  version: number;
  idStack: string[];
  undoEvents: UndoEvent[];
}

const UndoHistoryDB = new Dexie("undo-history") as Dexie & {
  history: EntityTable<StoredUndoHistory, "fileId">;
};

UndoHistoryDB.version(1).stores({
  entries: "pipelineName",
});

/**
 * The old table keyed on the pipeline's name, which two pipelines are allowed
 * to share once storage keys are opaque — and a collision here replays one
 * pipeline's undo events onto another. There is nothing to migrate: the events
 * only make sense against the ids of the spec they were recorded from.
 */
UndoHistoryDB.version(2).stores({
  entries: null,
  history: "fileId",
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
  fileId: string,
  idStack: string[],
  undoManager: UndoManager,
): Promise<void> {
  const rawEvents = undoManager.undoQueue.slice(-MAX_UNDO_EVENTS);
  const clonedEvents: UndoEvent[] = JSON.parse(JSON.stringify(rawEvents));

  await UndoHistoryDB.history.put({
    fileId,
    version: CURRENT_VERSION,
    idStack,
    undoEvents: clonedEvents,
  });
}

export async function loadUndoHistory(
  fileId: string,
): Promise<StoredUndoHistory | null> {
  const data = await UndoHistoryDB.history.get(fileId);

  if (!data) return null;
  if (data.version !== CURRENT_VERSION) return null;
  if (!data.idStack?.length || !data.undoEvents?.length) return null;

  return data;
}

export function createUndoStoreWithEvents(events: UndoEvent[]): UndoStore {
  return new UndoStore({ undoEvents: events });
}
