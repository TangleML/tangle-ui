export function normalizeMetadataAnnotations(
  annotations: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(annotations).flatMap(([key, value]) => {
      if (value === null || value === undefined) return [];
      return [
        [
          key,
          typeof value === "object" ? JSON.stringify(value) : String(value),
        ],
      ];
    }),
  );
}
