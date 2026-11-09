import { useState } from "react";

import { getStorage } from "@/utils/typedStorage";

const ARCHIVED_KEY = "tangent-project-archived-items";

const storage = getStorage<
  typeof ARCHIVED_KEY,
  { [ARCHIVED_KEY]: Record<string, string[]> }
>();

/**
 * What someone archived out of a project's card, kept in this browser by
 * project. Archiving only hides an item from the card; it stays in the
 * project and can be restored.
 */
export function useArchivedProjectItems(projectId: string) {
  const [byProject, setByProject] = useState<Record<string, string[]>>(
    () => storage.getItem(ARCHIVED_KEY) ?? {},
  );
  const archived = new Set(byProject[projectId] ?? []);

  function save(next: Set<string>) {
    const updated = { ...byProject, [projectId]: [...next] };
    setByProject(updated);
    storage.setItem(ARCHIVED_KEY, updated);
  }

  return {
    isArchived: (key: string) => archived.has(key),
    archive: (key: string) => save(new Set(archived).add(key)),
    restore: (key: string) => {
      const next = new Set(archived);
      next.delete(key);
      save(next);
    },
  };
}
