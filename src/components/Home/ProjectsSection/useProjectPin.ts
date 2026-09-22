import { useFavorites } from "@/hooks/useFavorites";
import useToastNotification from "@/hooks/useToastNotification";

interface ProjectPin {
  pinned: boolean;
  togglePin: () => void;
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

  const pinned = isFavorite("project", project.id);

  return {
    pinned,
    togglePin: () => {
      void toggleFavorite({
        type: "project",
        id: project.id,
        name: project.name,
      });
      notify(pinned ? "Project unpinned" : "Project pinned", "success");
    },
  };
}
