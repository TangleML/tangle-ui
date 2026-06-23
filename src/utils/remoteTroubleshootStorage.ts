import { getStorage } from "./typedStorage";

interface RemoteTroubleshootRecord {
  runId: string;
  executionId: string;
  requestedAt: string;
}

interface RemoteTroubleshootStorageMap {
  "remote-troubleshoot-requests": RemoteTroubleshootRecord[];
}

const storage = getStorage<
  keyof RemoteTroubleshootStorageMap,
  RemoteTroubleshootStorageMap
>();

export function getRemoteTroubleshootRecord(
  runId: string,
  executionId: string,
): RemoteTroubleshootRecord | undefined {
  const records = storage.getItem("remote-troubleshoot-requests") ?? [];
  return records.find(
    (r) => r.runId === runId && r.executionId === executionId,
  );
}

export function saveRemoteTroubleshootRecord(
  runId: string,
  executionId: string,
): void {
  const records = storage.getItem("remote-troubleshoot-requests") ?? [];
  const exists = records.some(
    (r) => r.runId === runId && r.executionId === executionId,
  );
  if (exists) return;
  storage.setItem("remote-troubleshoot-requests", [
    ...records,
    { runId, executionId, requestedAt: new Date().toISOString() },
  ]);
}
