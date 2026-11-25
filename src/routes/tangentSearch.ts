import { PI_AGENT } from "@tangent/shared/contracts.ts";

import type { WorkareaTarget } from "@/services/projects/resourceTarget";
import {
  formatWorkareaTarget,
  isWorkareaTargetString,
  parseWorkareaTarget,
} from "@/services/projects/resourceTarget";

const TANGENT_SESSION_SEARCH_PARAM = "session";
const TANGENT_OPEN_SEARCH_PARAM = "open";

const NEW_SESSION = "new";

export interface TangentMessageTarget {
  messageId: string;
  agentId?: string;
}

export type TangentSessionParam =
  | { kind: "new" }
  | { kind: "existing"; sessionId: string; message?: TangentMessageTarget };

function readId(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/**
 * The router JSON-parses search params, so a session id of digits arrives as a
 * number and anything at all can arrive as an array or object.
 */
export function readTangentSessionParam(
  search: unknown,
): TangentSessionParam | undefined {
  if (
    typeof search !== "object" ||
    search === null ||
    !(TANGENT_SESSION_SEARCH_PARAM in search)
  ) {
    return undefined;
  }

  const sessionId = readId(search.session);
  if (!sessionId) return undefined;
  if (sessionId === NEW_SESSION) return { kind: "new" };

  const messageId = "message" in search ? readId(search.message) : undefined;
  const agentId = "agent" in search ? readId(search.agent) : undefined;
  if (!messageId || ("agent" in search && !agentId)) {
    return { kind: "existing", sessionId };
  }
  return {
    kind: "existing",
    sessionId,
    message: {
      messageId,
      agentId: agentId === PI_AGENT.id ? undefined : agentId,
    },
  };
}

export function readTangentOpenParam(
  search: unknown,
): WorkareaTarget | undefined {
  if (
    typeof search !== "object" ||
    search === null ||
    !(TANGENT_OPEN_SEARCH_PARAM in search)
  ) {
    return undefined;
  }

  const value = search[TANGENT_OPEN_SEARCH_PARAM];
  return typeof value === "string" && isWorkareaTargetString(value)
    ? parseWorkareaTarget(value)
    : undefined;
}

export function withoutTangentArrivalSearch(
  search: Record<string, unknown>,
): Record<string, unknown> {
  const next = withoutTangentSessionSearch(search);
  delete next[TANGENT_OPEN_SEARCH_PARAM];
  return next;
}

export function withoutTangentMessageSearch(search: Record<string, unknown>) {
  const next = { ...search };
  delete next.message;
  delete next.agent;
  return next;
}

export function withoutTangentSessionSearch(search: Record<string, unknown>) {
  const next = withoutTangentMessageSearch(search);
  delete next[TANGENT_SESSION_SEARCH_PARAM];
  return next;
}

export function withoutTangentOpenSearch(
  search: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...search };
  delete next[TANGENT_OPEN_SEARCH_PARAM];
  return next;
}

export const tangentOpenSearch = (target: WorkareaTarget) => ({
  [TANGENT_OPEN_SEARCH_PARAM]: formatWorkareaTarget(target),
});

export const newTangentSessionSearch = {
  [TANGENT_SESSION_SEARCH_PARAM]: NEW_SESSION,
};

export const tangentSessionSearch = (
  sessionId: string,
  message?: TangentMessageTarget,
) => ({
  [TANGENT_SESSION_SEARCH_PARAM]: sessionId,
  ...(message && { message: message.messageId }),
  ...(message?.agentId && { agent: message.agentId }),
});
