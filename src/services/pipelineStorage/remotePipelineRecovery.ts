import { Dexie, type EntityTable } from "dexie";

import type { CloudPipeline } from "@/services/cloudPipelineService";

export interface RemotePipelineRecovery {
  key: string;
  scope: string;
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
  cloneSource?: CloudPipeline;
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
