import type { ComponentReference } from "@/utils/componentSpec";

import type { Library } from "./types";

/**
 * Dispatch a change event to the library's event emitter.
 * @param library - The library to dispatch the event to.
 * @param type - The type of change to dispatch.
 * @param component - The component that was added or removed.
 */
export function dispatchLibraryChangeEvent(
  library: Library,
  type: "add" | "remove" | "refresh",
  component?: ComponentReference,
) {
  library.eventEmitter?.dispatchEvent(
    new CustomEvent("change", {
      detail: {
        type,
        component,
      },
    }),
  );
}
