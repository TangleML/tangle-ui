/**
 * Returns HTML data attributes that the document-level click tracker
 * (`useClickTracking`) reads to fire an analytics event automatically.
 *
 * Spread the result onto any interactive element (`<button>`, `<a>`, etc.):
 *
 * ```tsx
 * <Button {...tracking("header.settings")} onClick={navigate} />
 * ```
 *
 * The document-level click listener appends `.click` to the action type
 * automatically, so only provide the identifier here.
 */
/** @public */
export function tracking(
  actionType: string,
  metadata?: Record<string, unknown>,
): { "data-tracking-id": string; "data-tracking-metadata"?: string } {
  const attrs: {
    "data-tracking-id": string;
    "data-tracking-metadata"?: string;
  } = {
    "data-tracking-id": actionType,
  };
  if (metadata !== undefined) {
    attrs["data-tracking-metadata"] = JSON.stringify(metadata);
  }
  return attrs;
}
