const SHARED_FOLDER_ID = "tangentSharedFolderId";

/** Anyone may PATCH a project, so the stored id may be anything at all. */
export function readProjectSharedFolderId(
  metadata: Record<string, unknown> | null | undefined,
): string | undefined {
  const id = metadata?.[SHARED_FOLDER_ID];
  return typeof id === "string" && id.trim() !== "" ? id : undefined;
}

export function withProjectSharedFolderId(
  metadata: Record<string, unknown> | null | undefined,
  folderId: string,
): Record<string, unknown> {
  return { ...(metadata ?? {}), [SHARED_FOLDER_ID]: folderId };
}
