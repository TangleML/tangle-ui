import { useSyncExternalStore } from "react";

import { getStorage } from "@/utils/typedStorage";

import { isProjectColor, type ProjectColor } from "./projectColors";

const STORAGE_KEY = "projectColors";

type ProjectColorsStorage = {
  [STORAGE_KEY]: Record<string, ProjectColor>;
};

const storage = getStorage<typeof STORAGE_KEY, ProjectColorsStorage>();

/**
 * Colours live in this browser, not on the project.
 *
 * `GET /api/projects/` answers with the summary shape, which omits
 * `extra_data`, so a colour stored on the project cannot reach a card in the
 * list. This stands in until that changes: swap the two accessors below for the
 * project's own `extraData.color` and a PATCH, and nothing above here moves.
 */
let cachedRaw: string | null = null;
let cachedColors: Record<string, ProjectColor> = {};

function getSnapshot(): Record<string, ProjectColor> {
  // Read the raw string, not the parsed object: useSyncExternalStore compares
  // snapshots by identity, and a fresh parse every call never settles.
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) {
    return cachedColors;
  }

  cachedRaw = raw;
  cachedColors = raw ? readColors(raw) : {};
  return cachedColors;
}

function readColors(raw: string): Record<string, ProjectColor> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(([, color]) => isProjectColor(color)),
    ) as Record<string, ProjectColor>;
  } catch {
    return {};
  }
}

function subscribe(listener: () => void) {
  function handleStorageChange(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      queueMicrotask(listener);
    }
  }

  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}

export function useProjectColors() {
  const colors = useSyncExternalStore(subscribe, getSnapshot);

  return {
    getColor: (projectId: string): ProjectColor | undefined =>
      colors[projectId],

    setColor: (projectId: string, color: ProjectColor | undefined) => {
      const next = { ...(storage.getItem(STORAGE_KEY) ?? {}) };
      if (color) {
        next[projectId] = color;
      } else {
        delete next[projectId];
      }
      storage.setItem(STORAGE_KEY, next);
    },
  };
}
