import { PipelineSpecApiError } from "@/services/pipelineSpecService";
import { findRemotePipelineDocumentByPath } from "@/services/remotePipelineEditorService";
import { normalizeBackendUrl } from "@/utils/backendIdentity";

import { pipelineStorageDb } from "./db";
import { movePipelineAssociationsToRemote } from "./pipelineAssociations";
import type { PipelineFile } from "./PipelineFile";
import {
  assertPipelineMigrationBackend,
  findPipelineMigration,
  forgetPipelineMigration,
  rememberPipelineMigration,
} from "./pipelineMigrations";
import type { PipelineStorageService } from "./PipelineStorageService";
import type { RemotePipelineRef } from "./types";

export class PipelineMigrationRecoveryError extends Error {
  constructor(
    message: string,
    readonly remote: PipelineFile,
    cause?: unknown,
    readonly hasLocalChanges = false,
  ) {
    super(message, { cause });
    this.name = "PipelineMigrationRecoveryError";
  }
}

export interface PipelineMigrationOptions {
  keepLocalCopy?: boolean;
}

const pendingMigrations = new Map<string, Promise<unknown>>();

export async function migrateLocalPipelineToRemote(
  storage: PipelineStorageService,
  local: PipelineFile,
  backendUrl: string,
  onCreated?: (remote: PipelineFile) => Promise<unknown>,
  options: PipelineMigrationOptions = {},
): Promise<PipelineFile> {
  if (local.remote) {
    assertPipelineMigrationBackend(local.remote, backendUrl);
    await onCreated?.(local);
    return local;
  }
  const key = `pipeline-migration:${local.id}`;
  const previous = pendingMigrations.get(key) ?? Promise.resolve();
  const operation = previous
    .catch(() => undefined)
    .then(() => {
      const run = () => migrate(storage, local, backendUrl, onCreated, options);
      return globalThis.navigator?.locks
        ? navigator.locks.request(key, run)
        : run();
    });
  pendingMigrations.set(key, operation);
  try {
    return await operation;
  } finally {
    if (pendingMigrations.get(key) === operation) pendingMigrations.delete(key);
  }
}

async function migrate(
  storage: PipelineStorageService,
  local: PipelineFile,
  backendUrl: string,
  onCreated?: (remote: PipelineFile) => Promise<unknown>,
  options: PipelineMigrationOptions = {},
): Promise<PipelineFile> {
  backendUrl = normalizeBackendUrl(backendUrl);
  const nameMigration = await findPipelineMigration({ name: local.storageKey });
  if (nameMigration && nameMigration.localId !== local.id) {
    throw new Error(
      "This browser recreated a local copy after this pipeline was moved. Your local changes were kept. Rename this copy before uploading it as a separate pipeline.",
    );
  }
  const migration = await findPipelineMigration({
    name: local.storageKey,
    fileId: local.id,
  });
  if (migration) assertPipelineMigrationBackend(migration.remote, backendUrl);
  let attempt = await pipelineStorageDb.pipeline_migration_attempts.get(
    local.id,
  );
  if (attempt && normalizeBackendUrl(attempt.backendUrl) !== backendUrl) {
    throw new Error(
      `An upload to ${attempt.backendUrl} may have completed. Reconnect to that backend to check before uploading elsewhere.`,
    );
  }
  const newAttempt = !attempt && !migration;
  if (newAttempt) {
    attempt = { localId: local.id, backendUrl, content: await local.read() };
    await pipelineStorageDb.pipeline_migration_attempts.put(attempt);
  }
  if (options.keepLocalCopy && !attempt?.keepLocalCopy) {
    // Project membership cannot be exhaustively discovered. Keep this policy
    // across retries and repairs of individual project links.
    attempt = {
      localId: local.id,
      backendUrl,
      content: attempt?.content ?? (await local.read()),
      keepLocalCopy: true,
    };
    await pipelineStorageDb.pipeline_migration_attempts.put(attempt);
  }
  const filePath = `pipelines/${local.id}.yaml`;
  let existing: RemotePipelineRef | undefined;
  try {
    existing = migration
      ? migration.remote
      : await findRemotePipelineDocumentByPath(backendUrl, filePath).then(
          (document) =>
            document && {
              source: "remote" as const,
              backendUrl,
              pipelineId: document.id,
            },
        );
  } catch (error) {
    if (newAttempt)
      await pipelineStorageDb.pipeline_migration_attempts.delete(local.id);
    throw error;
  }
  if (!existing) {
    attempt = {
      ...attempt,
      localId: local.id,
      backendUrl,
      content: await local.read(),
    };
    await pipelineStorageDb.pipeline_migration_attempts.put(attempt);
  }
  let remote: PipelineFile | undefined;
  if (migration) {
    try {
      remote = await storage.resolvePipeline(migration.remote);
    } catch (error) {
      if (!(error instanceof PipelineSpecApiError) || error.status !== 404)
        throw error;
      // Confirm the former path is absent before retiring a stale alias. A
      // missing GET route must not cause a duplicate upload.
      const recovered = await findRemotePipelineDocumentByPath(
        backendUrl,
        filePath,
      );
      await forgetPipelineMigration(local.id, migration.remote);
      existing = recovered
        ? { source: "remote", backendUrl, pipelineId: recovered.id }
        : undefined;
      attempt = {
        ...attempt,
        localId: local.id,
        backendUrl,
        content: await local.read(),
      };
      await pipelineStorageDb.pipeline_migration_attempts.put(attempt);
    }
  }
  try {
    remote ??= existing
      ? await storage.resolvePipeline(existing)
      : await storage.createRemotePipeline(
          backendUrl,
          local.storageKey,
          attempt?.content ?? (await local.read()),
          filePath,
        );
  } catch (error) {
    if (
      !existing &&
      error instanceof PipelineSpecApiError &&
      ((error.status >= 400 && error.status < 500 && error.status !== 408) ||
        error.status === 501)
    ) {
      await pipelineStorageDb.pipeline_migration_attempts.delete(local.id);
    }
    throw error;
  }
  try {
    await rememberPipelineMigration(
      local,
      { source: "remote", backendUrl, pipelineId: remote.id },
      remote.storageKey,
    );
    await onCreated?.(remote);
    if (!attempt) {
      if (await local.folder.driver.hasKey(local.storageKey)) {
        throw new PipelineMigrationRecoveryError(
          "The saved pipeline is available, but this browser also has local changes. Both copies were kept.",
          remote,
          undefined,
          true,
        );
      }
      return remote;
    }
    await movePipelineAssociationsToRemote(local, remote);
    if ((await local.read()) !== attempt.content) {
      throw new PipelineMigrationRecoveryError(
        "These local changes were not uploaded. Both the saved pipeline and this browser's copy were kept. Use Save as to save the local changes as a separate pipeline.",
        remote,
        undefined,
        true,
      );
    }
    if (attempt.keepLocalCopy) return remote;
  } catch (cause) {
    if (cause instanceof PipelineMigrationRecoveryError) throw cause;
    throw new PipelineMigrationRecoveryError(
      "Pipeline was uploaded, but its saved links could not be updated. The copy in this browser was kept.",
      remote,
      cause,
    );
  }
  try {
    await local.deleteFile();
    await pipelineStorageDb.pipeline_migration_attempts.delete(local.id);
  } catch (cause) {
    throw new PipelineMigrationRecoveryError(
      "Pipeline was uploaded, but the copy in this browser could not be removed.",
      remote,
      cause,
    );
  }
  return remote;
}
