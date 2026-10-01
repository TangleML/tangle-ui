import {
  type AgentTraceEvent,
  subscribeToTraceEvents,
  type TraceScope,
} from "@/agent/middleware/agentTrace";

const STORAGE_KEY = "agent_trace_log";
const MAX_EVENTS = 400;

function read(): AgentTraceEvent[] {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    return Array.isArray(stored) ? (stored as AgentTraceEvent[]) : [];
  } catch {
    return [];
  }
}

function write(events: AgentTraceEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // A quota failure must not take down the turn that produced the event.
  }
}

const isIn = (scope: TraceScope) => (event: AgentTraceEvent) =>
  event.scope?.sessionId === scope.sessionId;

export function readAgentTraceLog(scope?: TraceScope): AgentTraceEvent[] {
  const events = read();
  return scope ? events.filter(isIn(scope)) : events;
}

/** Clears what the reader was shown; without a scope, the whole log. */
export function clearAgentTraceLog(scope?: TraceScope): void {
  if (scope) {
    write(read().filter((event) => !isIn(scope)(event)));
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover: the log is a diagnostic, not state anything reads.
  }
}

/**
 * Collects the broadcast events into `localStorage` so the log outlives the
 * worker that produced it and covers every worker at once. Started from the app
 * entry point, because events arrive long before anyone opens the log.
 */
export function startAgentTraceLog(): () => void {
  return subscribeToTraceEvents((event) => {
    const events = read();
    events.push(event);
    write(events.slice(-MAX_EVENTS));
  });
}
