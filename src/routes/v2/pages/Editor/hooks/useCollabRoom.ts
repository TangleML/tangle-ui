import { useSearch } from "@tanstack/react-router";

import { useFlagValue } from "@/components/shared/Settings/useFlags";

interface CollabRoom {
  room: string | null;
  active: boolean;
}

export function useCollabRoom(): CollabRoom {
  const flag = useFlagValue("collab-poc");
  const search = useSearch({ strict: false });
  const room =
    "collab" in search && typeof search.collab === "string"
      ? search.collab
      : null;
  return { room, active: flag && room !== null };
}
