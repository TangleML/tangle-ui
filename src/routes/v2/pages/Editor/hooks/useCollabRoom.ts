import { useParams, useSearch } from "@tanstack/react-router";

import { useFlagValue } from "@/components/shared/Settings/useFlags";

interface CollabRoom {
  room: string | null;
  active: boolean;
  seedFromClient: boolean;
}

// A legacy `?collab=<room>` room is a throwaway string with no backend
// pipeline, so the client seeds it. A `/c/$roomId` room is a backend pipeline
// id the server seeds from the backend instead.

export function useCollabRoom(): CollabRoom {
  const flag = useFlagValue("collab-poc");
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });

  const roomFromPath =
    "roomId" in params && typeof params.roomId === "string"
      ? params.roomId
      : null;
  const roomFromSearch =
    "collab" in search && typeof search.collab === "string"
      ? search.collab
      : null;

  const room = roomFromPath ?? roomFromSearch;
  return {
    room,
    active: flag && room !== null,
    seedFromClient: roomFromPath === null,
  };
}
