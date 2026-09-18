import { type RefCallback, useCallback, useRef } from "react";

import { useIsModalSurface } from "@/providers/ModalSurfaceProvider";

const CONTAINED_EVENTS = ["copy", "cut", "paste"] as const;

const openSurfaces = new Set<HTMLElement>();

function containEvent(event: Event) {
  event.stopPropagation();
}

function openSurface(surface: HTMLElement) {
  if (openSurfaces.size === 0) {
    for (const type of CONTAINED_EVENTS) {
      document.documentElement.addEventListener(type, containEvent);
    }
  }
  openSurfaces.add(surface);
}

function closeSurface(surface: HTMLElement) {
  openSurfaces.delete(surface);
  if (openSurfaces.size > 0) return;

  for (const type of CONTAINED_EVENTS) {
    document.documentElement.removeEventListener(type, containEvent);
  }
}

/**
 * Keeps clipboard events inside the page while a modal surface is open, so
 * document- and window-level listeners cannot act on a paste the user meant
 * for the dialog. Attach the returned callback as the surface element's ref.
 *
 * The boundary sits on the bubble phase of the root element, so everything
 * nested below it still runs: the dialog's own handlers, and React's listeners
 * on both the app root and the portal container. Propagation is all that
 * stops, so native pasting into fields is unaffected.
 */
export function useModalClipboardGuard<
  T extends HTMLElement,
>(): RefCallback<T> {
  const modal = useIsModalSurface();
  const contained = useRef<T | null>(null);

  return useCallback(
    (surface: T | null) => {
      if (contained.current) {
        closeSurface(contained.current);
        contained.current = null;
      }
      if (surface && modal) {
        openSurface(surface);
        contained.current = surface;
      }
    },
    [modal],
  );
}
