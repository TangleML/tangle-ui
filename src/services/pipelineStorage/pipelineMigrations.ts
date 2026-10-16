import { pipelineStorageDb } from "./db";
import type { PipelineRef, RemotePipelineRef } from "./types";

export function findPipelineMigration(ref: PipelineRef) {
  return pipelineStorageDb.pipeline_migrations.get(
    ref.fileId ? `id:${ref.fileId}` : `name:${ref.name}`,
  );
}

export async function rememberPipelineMigration(
  local: { id: string; storageKey: string },
  remote: RemotePipelineRef,
  name: string,
): Promise<void> {
  // Keep ID links forever; a later migration may reuse the legacy name.
  await pipelineStorageDb.transaction(
    "rw",
    pipelineStorageDb.pipeline_migrations,
    () =>
      pipelineStorageDb.pipeline_migrations.bulkPut([
        { key: `id:${local.id}`, remote, name },
        { key: `name:${local.storageKey}`, remote, name },
      ]),
  );
}
