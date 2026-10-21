export function getRemotePipelineSavedId(
  backendUrl: string,
  pipelineId: string,
) {
  return `remote:${encodeURIComponent(backendUrl.replace(/\/+$/, ""))}:${pipelineId}`;
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
      return { backendUrl, pipelineId: match[2] };
    }
  } catch {
    // Ordinary local names and malformed saved IDs remain local.
  }
  return undefined;
}

export function isSavedPipelineForBackend(
  item: { type: string; id: string },
  backendUrl: string,
): boolean {
  const remote =
    item.type === "pipeline" && parseRemotePipelineSavedId(item.id);
  return (
    !remote ||
    remote.backendUrl.replace(/\/+$/, "") === backendUrl.replace(/\/+$/, "")
  );
}
