import { useEffect, useState } from "react";
import { io } from "socket.io-client";

import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { getTangentSocketConfig } from "@/routes/v2/pages/Tangent/services/socketConfig";
import { isRecord } from "@/utils/typeGuards";

const SUBSCRIBE_EVENT = "session:status:subscribe";
const SNAPSHOT_EVENT = "session:status:snapshot";
const STATUS_EVENT = "session:status";

export type SessionRunState = "working" | "failed";

export type SessionRunStates = ReadonlyMap<string, SessionRunState>;

/** What one lobby status says to show beside its chat, if anything. */
function runStateOf(
  status: unknown,
): { sessionId: string; state?: SessionRunState } | undefined {
  if (!isRecord(status) || typeof status.sessionId !== "string") {
    return undefined;
  }
  const { sessionId } = status;
  if (status.status === "busy") return { sessionId, state: "working" };
  if (status.failed === true) return { sessionId, state: "failed" };
  return { sessionId };
}

export function runStatesFromSnapshot(snapshot: unknown): SessionRunStates {
  const statuses =
    isRecord(snapshot) && Array.isArray(snapshot.statuses)
      ? snapshot.statuses
      : [];
  return new Map(
    statuses.flatMap((status) => {
      const parsed = runStateOf(status);
      return parsed?.state ? [[parsed.sessionId, parsed.state] as const] : [];
    }),
  );
}

export function withRunStatus(
  states: SessionRunStates,
  status: unknown,
): SessionRunStates {
  const parsed = runStateOf(status);
  if (!parsed) return states;
  const next = new Map(states);
  if (parsed.state) {
    next.set(parsed.sessionId, parsed.state);
  } else {
    next.delete(parsed.sessionId);
  }
  return next;
}

/**
 * The chats with an agent working, or whose last run failed, from Tangent's
 * sessions lobby, so the sidebar can mark them. One socket covers every
 * project's chats on this Tangent.
 */
export function useSessionRunStates(baseUrl: string | null): SessionRunStates {
  const authToken = useRemoteEnvAuthToken();
  const [states, setStates] = useState<SessionRunStates>(() => new Map());

  useEffect(() => {
    if (!baseUrl) return;
    const { socketUrl, socketPath } = getTangentSocketConfig(baseUrl);
    const socket = io(socketUrl, {
      path: socketPath,
      auth: authToken ? { token: authToken } : {},
    });
    socket.on("connect", () => socket.emit(SUBSCRIBE_EVENT));
    socket.on(SNAPSHOT_EVENT, (snapshot: unknown) =>
      setStates(runStatesFromSnapshot(snapshot)),
    );
    socket.on(STATUS_EVENT, (status: unknown) =>
      setStates((current) => withRunStatus(current, status)),
    );
    return () => {
      socket.disconnect();
    };
  }, [baseUrl, authToken]);

  return states;
}
