import { runWithConcurrency } from "@/utils/concurrency";

import { pipelineStorageDb } from "./db";
import type { PipelineFolder } from "./PipelineFolder";

const DELETE_CONCURRENCY = 3;

/**
 * Puts the backend store back to how someone who has never used one finds it,
 * so the copy that runs on first use can be tried again. Development only.
 *
 * Browser storage is deliberately untouched: it is what the copy reads from,
 * and its registry rows are the only record of which folder a pipeline is in.
 */
export async function resetBackendPipelines(
  folder: PipelineFolder,
): Promise<number> {
  const files = await folder.listPipelines();
  await runWithConcurrency(files, DELETE_CONCURRENCY, (file) =>
    file.deleteFile(),
  );

  await pipelineStorageDb.pipeline_registry
    .where("storage")
    .equals("backend")
    .delete();

  /**
   * Both are only ever written against a backend, and both are re-readable.
   */
  await pipelineStorageDb.pipeline_specs.clear();
  await pipelineStorageDb.pending_writes.clear();

  await pipelineStorageDb.host_migration.clear();

  return files.length;
}
