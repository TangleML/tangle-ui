import { useEffect, useState } from "react";
import { io } from "socket.io-client";

import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { getTangentSocketConfig } from "@/routes/v2/pages/Tangent/services/socketConfig";
import { getStorage } from "@/utils/typedStorage";
import { isRecord } from "@/utils/typeGuards";

const SUBSCRIBE_EVENT = "session:status:subscribe";
const SNAPSHOT_EVENT = "session:status:snapshot";
const STATUS_EVENT = "session:status";

const SEEN_KEY = "tangent-sessions-seen";
// Plenty for the chats anyone opens in a long while; the oldest fall off.
const MAX_SEEN = 500;

/** Per chat, when it had last stopped working as of the last time it was open. */
export type SeenEndings = Readonly<Record<string, string>>;

const storage = getStorage<typeof SEEN_KEY, { [SEEN_KEY]: unknown }>();

export type SessionRunState = "working" | "finished" | "failed";

export type SessionRunStates = ReadonlyMap<string, SessionRunState>;

/** A chat's latest word from Tangent's sessions lobby. */
type LobbyStatus =
  { working: true } | { working: false; failed: boolean; endedAt: string };

export type LobbyStatuses = ReadonlyMap<string, LobbyStatus>;

function lobbyStatusOf(
  status: unknown,
): { sessionId: string; status?: LobbyStatus } | undefined {
  if (!isRecord(status) || typeof status.sessionId !== "string") {
    return undefined;
  }
  const { sessionId } = status;
  if (status.status === "busy") return { sessionId, status: { working: true } };
  if (typeof status.endedAt !== "string") return { sessionId };
  return {
    sessionId,
    status: {
      working: false,
      failed: status.failed === true,
      endedAt: status.endedAt,
    },
  };
}

export function statusesFromSnapshot(snapshot: unknown): LobbyStatuses {
  const statuses =
    isRecord(snapshot) && Array.isArray(snapshot.statuses)
      ? snapshot.statuses
      : [];
  return new Map(
    statuses.flatMap((status) => {
      const parsed = lobbyStatusOf(status);
      return parsed?.status ? [[parsed.sessionId, parsed.status] as const] : [];
    }),
  );
}

export function withStatus(
  statuses: LobbyStatuses,
  status: unknown,
): LobbyStatuses {
  const parsed = lobbyStatusOf(status);
  if (!parsed) return statuses;
  const next = new Map(statuses);
  if (parsed.status) {
    next.set(parsed.sessionId, parsed.status);
  } else {
    next.delete(parsed.sessionId);
  }
  return next;
}

/**
 * What to mark beside each chat: an agent working, or a run that finished or
 * failed since the chat was last open. The chat in view is being looked at, so
 * it never has a run waiting to be seen.
 */
export function runStatesToShow(
  statuses: LobbyStatuses,
  seen: SeenEndings,
  activeSessionId: string | undefined,
): SessionRunStates {
  const states = new Map<string, SessionRunState>();
  for (const [sessionId, status] of statuses) {
    if (status.working) {
      states.set(sessionId, "working");
    } else if (
      sessionId !== activeSessionId &&
      (seen[sessionId] ?? "") < status.endedAt
    ) {
      states.set(sessionId, status.failed ? "failed" : "finished");
    }
  }
  return states;
}

export function rememberSeen(
  seen: SeenEndings,
  sessionId: string,
  endedAt: string,
): SeenEndings {
  const others = Object.entries(seen).filter(([id]) => id !== sessionId);
  return Object.fromEntries([...others, [sessionId, endedAt]].slice(-MAX_SEEN));
}

/** Every chat that had already stopped, as though each had just been seen. */
export function seenAsOf(statuses: LobbyStatuses): SeenEndings {
  return Object.fromEntries(
    [...statuses]
      .flatMap(([sessionId, status]) =>
        status.working ? [] : [[sessionId, status.endedAt] as const],
      )
      .slice(-MAX_SEEN),
  );
}

function readSeen(): SeenEndings | null {
  const stored = storage.getItem(SEEN_KEY);
  if (!isRecord(stored)) return null;
  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/**
 * The chats to mark in the sidebar, from Tangent's sessions lobby: one with an
 * agent working, or one whose run finished or failed since it was last open.
 * One socket covers every project's chats on this Tangent. Which runs have been
 * seen is remembered in this browser; a browser with nothing remembered yet
 * starts from what had already ended, rather than marking every chat at once.
 */
export function useSessionRunStates(
  baseUrl: string | null,
  activeSessionId: string | undefined,
): SessionRunStates {
  const authToken = useRemoteEnvAuthToken();
  const [statuses, setStatuses] = useState<LobbyStatuses>(() => new Map());
  const [seen, setSeen] = useState(readSeen);

  useEffect(() => {
    if (!baseUrl) return;
    const { socketUrl, socketPath } = getTangentSocketConfig(baseUrl);
    const socket = io(socketUrl, {
      path: socketPath,
      auth: authToken ? { token: authToken } : {},
    });
    socket.on("connect", () => socket.emit(SUBSCRIBE_EVENT));
    socket.on(SNAPSHOT_EVENT, (snapshot: unknown) => {
      const next = statusesFromSnapshot(snapshot);
      setStatuses(next);
      setSeen((current) => current ?? seenAsOf(next));
    });
    socket.on(STATUS_EVENT, (status: unknown) =>
      setStatuses((current) => withStatus(current, status)),
    );
    return () => {
      socket.disconnect();
    };
  }, [baseUrl, authToken]);

  const active = activeSessionId ? statuses.get(activeSessionId) : undefined;
  const activeEndedAt = active && !active.working ? active.endedAt : undefined;
  if (
    seen &&
    activeSessionId &&
    activeEndedAt &&
    seen[activeSessionId] !== activeEndedAt
  ) {
    setSeen(rememberSeen(seen, activeSessionId, activeEndedAt));
  }

  useEffect(() => {
    if (seen) storage.setItem(SEEN_KEY, seen);
  }, [seen]);

  return runStatesToShow(statuses, seen ?? {}, activeSessionId);
}
