import { normalizeBackendUrl } from "@/utils/backendIdentity";

import { pipelineStorageDb } from "./db";
import type { PipelineRef, RemotePipelineRef } from "./types";

export class PipelineMovedToBackendError extends Error {}

export function assertPipelineMigrationBackend(
  remote: Pick<RemotePipelineRef, "backendUrl">,
  backendUrl: string,
): void {
  if (
    normalizeBackendUrl(remote.backendUrl) !== normalizeBackendUrl(backendUrl)
  ) {
    throw new PipelineMovedToBackendError(
      `This pipeline was moved to ${remote.backendUrl}. Select that backend in Settings to open it.`,
    );
  }
}

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
        { key: `id:${local.id}`, localId: local.id, remote, name },
        { key: `name:${local.storageKey}`, localId: local.id, remote, name },
      ]),
  );
}

export async function forgetPipelineMigration(
  localId: string,
  remote: RemotePipelineRef,
): Promise<void> {
  await pipelineStorageDb.transaction(
    "rw",
    pipelineStorageDb.pipeline_migrations,
    async () => {
      const rows = await pipelineStorageDb.pipeline_migrations.toArray();
      await pipelineStorageDb.pipeline_migrations.bulkDelete(
        rows
          .filter(
            (row) =>
              row.localId === localId &&
              normalizeBackendUrl(row.remote.backendUrl) ===
                normalizeBackendUrl(remote.backendUrl) &&
              row.remote.pipelineId === remote.pipelineId,
          )
          .map((row) => row.key),
      );
    },
  );
}
