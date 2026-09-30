import { Dexie, type EntityTable } from "dexie";

import type {
  CloudPipeline,
  CloudPipelineSummary,
} from "@/services/cloudPipelineService";

export interface RemotePipelineRecovery {
  key: string;
  scope: string;
  documentId?: string;
  filePath: string;
  displayName: string;
  content: string;
  dirty: boolean;
  modifiedAt: number;
  localFileId?: string;
  localStorageKey?: string;
  migrated?: boolean;
  deleted?: boolean;
  revision?: number;
  ownerId?: string;
  pipeline?: CloudPipeline;
  summary?: CloudPipelineSummary;
  cloneSource?: CloudPipelineSummary;
  error?: string;
}

export const remotePipelineRecoveryDb = new Dexie(
  "tangle_remote_pipelines",
) as Dexie & {
  copies: EntityTable<RemotePipelineRecovery, "key">;
};

remotePipelineRecoveryDb.version(1).stores({
  copies: "key, scope, [scope+localFileId], [scope+filePath]",
});

export function recoveryKey(scope: string, filePath: string): string {
  return `pending:${encodeURIComponent(scope)}:${encodeURIComponent(filePath)}`;
}

export async function recoveryRecords(
  scope: string,
): Promise<RemotePipelineRecovery[]> {
  return remotePipelineRecoveryDb.copies.where("scope").equals(scope).toArray();
}

export function assertNotDeleted(record: RemotePipelineRecovery): void {
  if (record.deleted)
    throw new Error("This pipeline has been deleted from the server.");
}

export async function createRecovery(
  initial: RemotePipelineRecovery,
): Promise<RemotePipelineRecovery> {
  return remotePipelineRecoveryDb.transaction(
    "rw",
    remotePipelineRecoveryDb.copies,
    async () => {
      const existing = await remotePipelineRecoveryDb.copies.get(initial.key);
      if (existing) {
        assertNotDeleted(existing);
        return existing;
      }
      await remotePipelineRecoveryDb.copies.put(initial);
      return initial;
    },
  );
}

export async function stageRecovery(
  initial: RemotePipelineRecovery,
  content: string,
): Promise<RemotePipelineRecovery> {
  return remotePipelineRecoveryDb.transaction(
    "rw",
    remotePipelineRecoveryDb.copies,
    async () => {
      const previous =
        (await remotePipelineRecoveryDb.copies.get(initial.key)) ?? initial;
      assertNotDeleted(previous);
      const next: RemotePipelineRecovery = {
        ...previous,
        documentId: previous.documentId ?? initial.documentId,
        localStorageKey: initial.localStorageKey ?? previous.localStorageKey,
        displayName: initial.displayName,
        content,
        dirty: true,
        modifiedAt: Date.now(),
        revision: (previous.revision ?? 0) + 1,
      };
      await remotePipelineRecoveryDb.copies.put(next);
      return next;
    },
  );
}

export async function mergeRecovery(
  completed: RemotePipelineRecovery,
): Promise<RemotePipelineRecovery> {
  return remotePipelineRecoveryDb.transaction(
    "rw",
    remotePipelineRecoveryDb.copies,
    async () => {
      const latest = await remotePipelineRecoveryDb.copies.get(completed.key);
      if (latest?.deleted) return latest;
      // A response may confirm a server ID while a newer raw edit is already durable.
      const record =
        latest && latest.revision !== completed.revision
          ? {
              ...completed,
              content: latest.content,
              revision: latest.revision,
              modifiedAt: latest.modifiedAt,
              displayName: latest.displayName,
              localStorageKey: latest.localStorageKey,
              dirty: true,
            }
          : completed;
      await remotePipelineRecoveryDb.copies.put(record);
      return record;
    },
  );
}

export class PipelineMovedToRemoteError extends Error {
  constructor() {
    super(
      "This pipeline was moved to remote storage. Open it using the original account and backend.",
    );
  }
}

export async function assertLocalPipelineVisible(id: string): Promise<void> {
  const migrated = await remotePipelineRecoveryDb.copies
    .filter((record) => record.localFileId === id && record.migrated === true)
    .first();
  if (migrated) throw new PipelineMovedToRemoteError();
}

export function remotePipelineReference(
  backendUrl: string,
  pipelineId: string,
): string {
  return `remote:${encodeURIComponent(backendUrl.replace(/\/+$/, ""))}:${pipelineId}`;
}

export function parseRemotePipelineReference(
  reference: string,
): { backendUrl: string; pipelineId: string } | undefined {
  const match = /^remote:([^:]+):([^:]+)$/.exec(reference);
  if (!match) return undefined;
  try {
    return { backendUrl: decodeURIComponent(match[1]), pipelineId: match[2] };
  } catch {
    return undefined;
  }
}
