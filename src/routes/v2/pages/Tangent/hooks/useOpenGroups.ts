import { useState } from "react";

import { getStorage } from "@/utils/typedStorage";

const storage = getStorage<string, Record<string, Record<string, boolean>>>();

interface OpenGroupsOptions {
  defaultOpen: boolean;
  searching: boolean;
  initiallyOpen?: string;
}

interface OpenGroups {
  isOpen: (id: string, options?: { hasMatches: boolean }) => boolean;
  setOpen: (id: string, open: boolean) => void;
  reveal: (id: string) => void;
  forgetSearch: () => void;
}

/**
 * Which groups of a list are open. What is opened or closed outside a search
 * is remembered under `storageKey` across mounts. What is opened or closed
 * while searching lasts only until the search changes, so a search never
 * alters the remembered layout; meanwhile a group with matches is open unless
 * it was closed during that search.
 */
export function useOpenGroups(
  storageKey: string,
  { defaultOpen, searching, initiallyOpen }: OpenGroupsOptions,
): OpenGroups {
  const [remembered, setRemembered] = useState<Record<string, boolean>>(() => {
    const stored = storage.getItem(storageKey) ?? {};
    return initiallyOpen ? { ...stored, [initiallyOpen]: true } : stored;
  });
  const [whileSearching, setWhileSearching] = useState<Record<string, boolean>>(
    {},
  );

  return {
    isOpen(id, { hasMatches } = { hasMatches: false }) {
      const rememberedOpen = remembered[id] ?? defaultOpen;
      if (!searching) return rememberedOpen;
      return whileSearching[id] ?? (hasMatches || rememberedOpen);
    },
    setOpen(id, open) {
      if (searching) {
        setWhileSearching((current) => ({ ...current, [id]: open }));
        return;
      }
      const next = { ...remembered, [id]: open };
      setRemembered(next);
      storage.setItem(storageKey, next);
    },
    // For this mount only: a group opened by arriving in it rather than by
    // hand would otherwise be open on every later visit.
    reveal(id) {
      setRemembered((current) => ({ ...current, [id]: true }));
    },
    forgetSearch() {
      setWhileSearching({});
    },
  };
}
