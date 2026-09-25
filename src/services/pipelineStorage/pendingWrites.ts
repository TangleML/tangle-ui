import { pipelineStorageDb } from "./db";
import type { PipelineFile } from "./PipelineFile";
import { getPipelineStorageService } from "./PipelineStorageService";
import { isStorageAnswering, subscribeStorageHealth } from "./storageHealth";
import { currentStorageKind, isBackendStorage } from "./storageMode";

/**
 * Edits the backend refused, kept where a reload cannot lose them and sent
 * again when it answers. Browser storage does not need this: it does not go
 * away between one write and the next.
 */
export async function recordPendingWrite(
  file: PipelineFile,
  yaml: string,
): Promise<void> {
  if (!isBackendStorage()) return;

  await pipelineStorageDb.pending_writes.put({
    storage: currentStorageKind(),
    storageKey: file.storageKey,
    yaml,
    recordedAt: Date.now(),
  });
}

export async function forgetPendingWrite(file: PipelineFile): Promise<void> {
  if (!isBackendStorage()) return;

  await pipelineStorageDb.pending_writes.delete([
    currentStorageKind(),
    file.storageKey,
  ]);
}

async function flushPendingWrites(): Promise<void> {
  if (!isBackendStorage()) return;

  const storage = currentStorageKind();
  const held = await pipelineStorageDb.pending_writes
    .where({ storage })
    .toArray();

  const { rootFolder } = getPipelineStorageService();

  for (const write of held) {
    try {
      await rootFolder.addFile(write.storageKey, write.yaml);
      await pipelineStorageDb.pending_writes.delete([
        storage,
        write.storageKey,
      ]);
    } catch (error) {
      /**
       * Still not taking writes. The record stays exactly as it is and the next
       * recovery tries again; nothing else in the list should be abandoned
       * because one of them failed.
       */
      console.error(
        `Could not send the held edit to "${write.storageKey}":`,
        error,
      );
    }
  }
}

/**
 * Sends whatever is held now, and again each time the backend goes from silent
 * to answering. Started with the app rather than with an editor, because the
 * editor that made the edit may be long gone.
 */
export function startPendingWriteFlusher(): () => void {
  let wasAnswering = isStorageAnswering();

  void flushPendingWrites().catch((error: unknown) => {
    console.error("Could not send held edits:", error);
  });

  return subscribeStorageHealth(() => {
    const answering = isStorageAnswering();
    const recovered = answering && !wasAnswering;
    wasAnswering = answering;
    if (!recovered) return;

    void flushPendingWrites().catch((error: unknown) => {
      console.error("Could not send held edits:", error);
    });
  });
}
