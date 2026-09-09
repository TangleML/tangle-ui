import { runWithConcurrency } from "@/utils/concurrency";
import { getErrorMessage } from "@/utils/string";

import { pipelineStorageDb } from "./db";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import type { PipelineFolder } from "./PipelineFolder";
import type { HostMigrationRecord } from "./types";

const RECORD_ID = "v1";
const COPY_CONCURRENCY = 3;

/**
 * How long a claim is honoured without progress. A tab that crashes mid-copy
 * would otherwise hold the claim forever and no tab could ever finish the
 * migration; the working tab pushes this forward after every pipeline, so only
 * a genuinely dead one loses it.
 */
const CLAIM_STALE_MS = 60_000;

export type HostMigrationClaim = "claimed" | "in-progress" | "settled";

export interface HostMigrationProgress {
  copied: number;
  failed: number;
  total: number;
}

export async function readHostMigration(): Promise<
  HostMigrationRecord | undefined
> {
  return pipelineStorageDb.host_migration.get(RECORD_ID);
}

/**
 * Testing the migration means running it more than once, and the whole point of
 * the record is that it only runs again if something is wrong. Exposed on the
 * window in development so it can be reset without hand-editing IndexedDB —
 * pipelines already copied stay in the store, so clear them there too for a
 * genuinely clean run.
 */
if (import.meta.env.DEV && typeof window !== "undefined") {
  window.resetPipelineStorageMigration = async () => {
    await pipelineStorageDb.host_migration.clear();
    await pipelineStorageDb.pipeline_specs.clear();
    console.info("Migration reset. Reload to run it again.");
  };
}

declare global {
  interface Window {
    resetPipelineStorageMigration?: () => Promise<void>;
  }
}

function isHostMigrationSettled(
  record: HostMigrationRecord | undefined,
): boolean {
  return record?.completedAt !== undefined || record?.dismissedAt !== undefined;
}

/**
 * Two tabs opening at once must not both copy the whole library. Reading the
 * record and claiming it are one transaction so exactly one of them wins.
 */
export async function claimHostMigration(): Promise<HostMigrationClaim> {
  return pipelineStorageDb.transaction(
    "rw",
    pipelineStorageDb.host_migration,
    async () => {
      const existing = await pipelineStorageDb.host_migration.get(RECORD_ID);

      if (isHostMigrationSettled(existing)) return "settled";

      if (existing && Date.now() - existing.startedAt < CLAIM_STALE_MS) {
        return "in-progress";
      }

      await pipelineStorageDb.host_migration.put({
        id: RECORD_ID,
        startedAt: Date.now(),
        copied: existing?.copied ?? [],
        failed: [],
      });

      return "claimed";
    },
  );
}

export async function dismissHostMigration(): Promise<void> {
  await pipelineStorageDb.host_migration.put({
    id: RECORD_ID,
    startedAt: Date.now(),
    dismissedAt: Date.now(),
    copied: (await readHostMigration())?.copied ?? [],
    failed: [],
  });
}

/**
 * Copies everything in browser storage into the host, keyed on the name it has
 * locally. Host writes upsert on the key they are given, so a pipeline copied
 * twice is overwritten rather than duplicated, and a run that died halfway can
 * simply be run again.
 *
 * The local store is left exactly as it was: this is a copy, and a build with
 * no host still has to find its pipelines.
 */
export async function runHostMigration(
  target: PipelineFolder,
  onProgress?: (progress: HostMigrationProgress) => void,
): Promise<HostMigrationRecord> {
  const source = new RootFolderDbStorageDriver();
  const local = await source.list();

  const record = await readHostMigration();
  const alreadyCopied = new Set(record?.copied ?? []);
  const outstanding = local.filter(
    (descriptor) => !alreadyCopied.has(descriptor.storageKey),
  );

  const copied = [...alreadyCopied];
  const failed: string[] = [];
  const report = () =>
    onProgress?.({
      copied: copied.length,
      failed: failed.length,
      total: local.length,
    });

  report();

  await runWithConcurrency(
    outstanding,
    COPY_CONCURRENCY,
    async (descriptor) => {
      try {
        await target.addFile(
          descriptor.storageKey,
          await source.read(descriptor.storageKey),
        );
        copied.push(descriptor.storageKey);
      } catch (error) {
        console.error(
          `Could not copy pipeline "${descriptor.storageKey}":`,
          getErrorMessage(error),
        );
        failed.push(descriptor.storageKey);
      }

      await pipelineStorageDb.host_migration.update(RECORD_ID, {
        startedAt: Date.now(),
        copied: [...copied],
        failed: [...failed],
      });
      report();
    },
  );

  const settled: HostMigrationRecord = {
    id: RECORD_ID,
    startedAt: Date.now(),
    completedAt: failed.length === 0 ? Date.now() : undefined,
    copied,
    failed,
  };

  await pipelineStorageDb.host_migration.put(settled);
  return settled;
}
