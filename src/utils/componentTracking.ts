import type { ComponentReference } from "./componentSpec";
import { getComponentName } from "./getComponentName";

type ComponentSource =
  | "user"
  | "library"
  | "published"
  | "url"
  | "file"
  | "unknown";

export type ComponentLibraryEntryPoint =
  | "favorite_button"
  | "canvas_file_drop"
  | "canvas_file_drop_v2"
  | "import_dialog"
  | "editor_save"
  | "unknown";

interface ComponentTrackingMetadata {
  component_id: string | undefined;
  component_name: string | undefined;
  component_source: ComponentSource;
}

/**
 * Standard metadata shape for component-scoped analytics events.
 *
 * Identity is anchored on `digest` (content-addressed) so events are stable
 * across renames and dedupable across versions. `component_name` is included
 * for human-readable dashboards. Both are non-PII.
 */
export function componentMetadata(
  ref: ComponentReference | undefined,
  source: ComponentSource = "unknown",
): ComponentTrackingMetadata {
  return {
    component_id: ref?.digest,
    component_name: ref ? getComponentName(ref) : undefined,
    component_source: source,
  };
}
