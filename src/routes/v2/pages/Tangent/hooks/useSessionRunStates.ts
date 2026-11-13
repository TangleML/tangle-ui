import { SocketEvents } from "@tangent/shared/contracts.ts";
import { useEffect, useState } from "react";

import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { connectTangentSocket } from "@/routes/v2/pages/Tangent/services/socketConfig";
import { getStorage } from "@/utils/typedStorage";
import { isRecord } from "@/utils/typeGuards";

const SEEN_KEY = "tangent-sessions-seen";
// Plenty for the chats anyone opens in a long while; the oldest fall off.
const MAX_SEEN = 500;

/**
 * Which runs this browser has seen: per chat, when it had last stopped
 * working as of the last time it was open, and before that, everything that
 * had ended by the time this browser first looked.
 */
export interface SeenRuns {
  baseline?: string;
  chats: Readonly<Record<string, string>>;
}

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
  seen: SeenRuns,
  activeSessionId: string | undefined,
): SessionRunStates {
  const states = new Map<string, SessionRunState>();
  for (const [sessionId, status] of statuses) {
    if (status.working) {
      states.set(sessionId, "working");
      continue;
    }
    const seenUpTo = seen.chats[sessionId] ?? seen.baseline ?? "";
    if (sessionId !== activeSessionId && seenUpTo < status.endedAt) {
      states.set(sessionId, status.failed ? "failed" : "finished");
    }
  }
  return states;
}

export function rememberSeen(
  seen: SeenRuns,
  sessionId: string,
  endedAt: string,
): SeenRuns {
  const others = Object.entries(seen.chats).filter(([id]) => id !== sessionId);
  return {
    ...seen,
    chats: Object.fromEntries(
      [...others, [sessionId, endedAt]].slice(-MAX_SEEN),
    ),
  };
}

/** The first time this browser looks, what had already ended counts as seen. */
export function withBaseline(
  seen: SeenRuns,
  statuses: LobbyStatuses,
): SeenRuns {
  if (seen.baseline !== undefined) return seen;
  const endings = [...statuses.values()].flatMap((status) =>
    status.working ? [] : [status.endedAt],
  );
  return { ...seen, baseline: endings.sort().at(-1) ?? "" };
}

/** `seen` with whatever another tab has seen later, so neither undoes the other. */
export function withSeenElsewhere(
  seen: SeenRuns,
  elsewhere: SeenRuns,
): SeenRuns {
  const chats = { ...elsewhere.chats, ...seen.chats };
  for (const [sessionId, endedAt] of Object.entries(elsewhere.chats)) {
    if (endedAt > (seen.chats[sessionId] ?? "")) chats[sessionId] = endedAt;
  }
  // Oldest first, so those are the ones that fall off.
  const oldestFirst = Object.entries(chats).sort(([, a], [, b]) =>
    a.localeCompare(b),
  );
  return {
    baseline: seen.baseline ?? elsewhere.baseline,
    chats: Object.fromEntries(oldestFirst.slice(-MAX_SEEN)),
  };
}

function readSeen(): SeenRuns {
  const stored = storage.getItem(SEEN_KEY);
  if (!isRecord(stored)) return { chats: {} };
  const chats = isRecord(stored.chats) ? stored.chats : {};
  return {
    baseline: typeof stored.baseline === "string" ? stored.baseline : undefined,
    chats: Object.fromEntries(
      Object.entries(chats).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  };
}

/**
 * The chats to mark in the sidebar, from Tangent's sessions lobby: one with an
 * agent working, or one whose run finished or failed since it was last open.
 * One socket covers every project's chats on this Tangent. Which runs have been
 * seen is remembered in this browser.
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
    const socket = connectTangentSocket(baseUrl, authToken);
    socket.on("connect", () =>
      socket.emit(SocketEvents.SessionStatusSubscribe),
    );
    socket.on(SocketEvents.SessionStatusSnapshot, (snapshot: unknown) => {
      const next = statusesFromSnapshot(snapshot);
      setStatuses(next);
      setSeen((current) => withBaseline(current, next));
    });
    socket.on(SocketEvents.SessionStatus, (status: unknown) =>
      setStatuses((current) => withStatus(current, status)),
    );
    return () => {
      socket.disconnect();
    };
  }, [baseUrl, authToken]);

  const active = activeSessionId ? statuses.get(activeSessionId) : undefined;
  const activeEndedAt = active && !active.working ? active.endedAt : undefined;
  if (
    activeSessionId &&
    activeEndedAt &&
    seen.chats[activeSessionId] !== activeEndedAt
  ) {
    setSeen(rememberSeen(seen, activeSessionId, activeEndedAt));
  }

  useEffect(() => {
    storage.setItem(SEEN_KEY, withSeenElsewhere(seen, readSeen()));
  }, [seen]);

  return runStatesToShow(statuses, seen, activeSessionId);
}
