import { HOURS } from "@/components/shared/ComponentEditor/constants";
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

const CACHE_NAME = "component-library";

/**
 * Fetch a resource from the network, and cache the response.
 * @param url - The URL to fetch.
 * @returns The response from the network.
 */
export async function fetchWithCache(url: string): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cacheResponse = await cache.match(url);
  if (cacheResponse) {
    if (!isResponseValid(cacheResponse)) {
      await cache.delete(url);
    } else {
      return cacheResponse;
    }
  }

  const response = await fetch(url);
  if (response.ok) {
    await cache.put(url, response.clone());
  }

  return response;
}

function isResponseValid(
  response: Response,
  maxAgeMs: number = 1 * HOURS,
): boolean {
  const dateHeader = response.headers.get("Date");

  if (dateHeader) {
    const cachedAt = new Date(dateHeader).getTime();
    return Date.now() - cachedAt <= maxAgeMs;
  }

  return false;
}
