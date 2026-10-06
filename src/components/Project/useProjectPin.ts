import { useState } from "react";

import { useFavorites } from "@/hooks/useFavorites";
import useToastNotification from "@/hooks/useToastNotification";

interface ProjectPin {
  pinned: boolean;
  isPinning: boolean;
  togglePin: () => Promise<void>;
}

/**
 * Pinning is how a project stays reachable: the projects list only holds the
 * ones the caller created, so a project someone shared is gone with the link
 * unless it is pinned. Backed by the favourites store, so a pinned project also
 * turns up under Favourites.
 */
export function useProjectPin(project: {
  id: string;
  name: string;
}): ProjectPin {
  const { isFavorite, toggleFavorite } = useFavorites();
  const notify = useToastNotification();
  const [isPinning, setIsPinning] = useState(false);

  const pinned = isFavorite("project", project.id);

  return {
    pinned,
    isPinning,
    togglePin: async () => {
      setIsPinning(true);
      try {
        await toggleFavorite({
          type: "project",
          id: project.id,
          name: project.name,
        });
        notify(pinned ? "Project unpinned" : "Project pinned", "success");
      } catch {
        notify(
          pinned ? "Could not unpin the project" : "Could not pin the project",
          "error",
        );
      } finally {
        setIsPinning(false);
      }
    },
  };
}
