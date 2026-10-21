export function normalizePipelineId(pipelineId: string): string {
  const uuid = pipelineId
    .replace(/^urn:uuid:/i, "")
    .replace(/^\{(.+)\}$/, "$1");
  if (
    !/^(?:[\da-f]{32}|[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i.test(
      uuid,
    )
  ) {
    return pipelineId;
  }

  const hex = uuid.replaceAll("-", "").toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
