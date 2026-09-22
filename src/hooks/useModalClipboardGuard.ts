import { type RefCallback, useCallback, useRef } from "react";

import { useIsModalSurface } from "@/providers/ModalSurfaceProvider";

const CONTAINED_EVENTS = ["copy", "cut", "paste"] as const;

const openSurfaces = new Map<HTMLElement, boolean>();

function containEvent(event: Event) {
  const { target } = event;
  for (const [surface, modal] of openSurfaces) {
    if (modal || (target instanceof Node && surface.contains(target))) {
      event.stopPropagation();
      return;
    }
  }
}

function openSurface(surface: HTMLElement, modal: boolean) {
  if (openSurfaces.size === 0) {
    for (const type of CONTAINED_EVENTS) {
      document.documentElement.addEventListener(type, containEvent);
    }
  }
  openSurfaces.set(surface, modal);
}

function closeSurface(surface: HTMLElement) {
  openSurfaces.delete(surface);
  if (openSurfaces.size > 0) return;

  for (const type of CONTAINED_EVENTS) {
    document.documentElement.removeEventListener(type, containEvent);
  }
}

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
      if (surface) {
        openSurface(surface, modal);
        contained.current = surface;
      }
    },
    [modal],
  );
}
