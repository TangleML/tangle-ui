/**
 * Todo: move this file to "persistence" layer.
 */
import Dexie, { type EntityTable } from "dexie";
import type { UndoEvent, UndoManager } from "mobx-keystone";
import { frozen, FrozenCheckMode, UndoStore } from "mobx-keystone";

import {
  IncrementingIdGenerator,
  serializeComponentSpecToText,
  YamlDeserializer,
} from "@/models/componentSpec";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  editorSpecFromRemoteTask,
  remotePipelineTaskFromSpec,
} from "@/services/pipelineStorage/remotePipelineTask";
import { getEditorPipelineIdentity } from "@/services/pipelineStorage/types";
import { componentSpecFromYaml } from "@/utils/yaml";

const CURRENT_VERSION = 2;
const MAX_UNDO_EVENTS = 10;

interface StoredUndoHistory {
  pipelineName: string;
  version: number;
  idStack: string[];
  undoEvents: UndoEvent[];
  yaml?: string;
}

const UndoHistoryDB = new Dexie("undo-history") as Dexie & {
  entries: EntityTable<StoredUndoHistory, "pipelineName">;
};

UndoHistoryDB.version(1).stores({
  entries: "pipelineName",
});

export function getUndoHistoryKey(
  file: Pick<PipelineFile, "storageKey"> &
    Partial<Pick<PipelineFile, "remote">>,
): string {
  return file.remote
    ? getEditorPipelineIdentity({ source: "remote", ...file.remote })
    : file.storageKey;
}

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
  undoManager: Pick<UndoManager, "undoQueue">,
  yaml?: string,
): Promise<void> {
  const rawEvents = undoManager.undoQueue.slice(-MAX_UNDO_EVENTS);
  const clonedEvents: UndoEvent[] = JSON.parse(JSON.stringify(rawEvents));

  await UndoHistoryDB.entries.put({
    pipelineName,
    version: CURRENT_VERSION,
    idStack,
    undoEvents: clonedEvents,
    yaml:
      yaml === undefined
        ? undefined
        : serializeComponentSpecToText(
            new YamlDeserializer(new IncrementingIdGenerator()).deserialize(
              editorSpecFromRemoteTask(
                remotePipelineTaskFromSpec(componentSpecFromYaml(yaml)),
              ),
            ),
          ),
  });
}

export async function loadUndoHistory(
  pipelineName: string,
  yaml?: string,
): Promise<StoredUndoHistory | null> {
  const data = await UndoHistoryDB.entries.get(pipelineName);

  if (!data) return null;
  if (data.version !== CURRENT_VERSION) return null;
  // An idStack alone is enough to replay stable `$id`s on load; undo events are
  // optional (a pipeline opened but never edited has none).
  if (!data.idStack?.length) return null;
  if (!data.undoEvents) return null;
  // Replay IDs and patches follow task insertion order, even for equal specs.
  if (
    yaml !== undefined &&
    (!data.yaml ||
      data.yaml !==
        serializeComponentSpecToText(
          new YamlDeserializer(new IncrementingIdGenerator()).deserialize(
            componentSpecFromYaml(yaml),
          ),
        ))
  ) {
    return null;
  }

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
  return new UndoStore({
    undoEvents: events.map((event) => frozen(event, FrozenCheckMode.Off)),
  });
}
