import { normalizeBackendUrl } from "@/utils/backendIdentity";

export function getRemotePipelineSavedId(
  backendUrl: string,
  pipelineId: string,
) {
  return `remote:${encodeURIComponent(normalizeBackendUrl(backendUrl))}:${pipelineId}`;
}

export function parseRemotePipelineSavedId(
  id: string,
): { backendUrl: string; pipelineId: string } | undefined {
  const match = /^remote:([^:]+):(.+)$/.exec(id);
  if (!match) return undefined;
  try {
    const backendUrl = decodeURIComponent(match[1]);
    const backend = new URL(backendUrl);
    if (backend.protocol === "http:" || backend.protocol === "https:") {
      return {
        backendUrl: normalizeBackendUrl(backendUrl),
        pipelineId: match[2],
      };
    }
  } catch {
    // Malformed saved IDs do not identify a remote pipeline.
  }
  return undefined;
}

export function isSavedPipelineForBackend(
  item: { type: string; id: string },
  backendUrl: string,
): boolean {
  if (item.type !== "pipeline") return true;
  const remote = parseRemotePipelineSavedId(item.id);
  return Boolean(
    remote && remote.backendUrl === normalizeBackendUrl(backendUrl),
  );
}

export function normalizeRemotePipelineSavedId(id: string): string {
  const remote = parseRemotePipelineSavedId(id);
  return remote
    ? getRemotePipelineSavedId(remote.backendUrl, remote.pipelineId)
    : id;
}
