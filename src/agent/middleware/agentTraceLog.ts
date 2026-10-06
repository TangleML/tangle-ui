import {
  type AgentTraceEvent,
  subscribeToTraceEvents,
  type TraceScope,
} from "@/agent/middleware/agentTrace";

const STORAGE_KEY = "agent_trace_log";
const MAX_EVENTS = 400;
const FLUSH_DELAY_MS = 1000;

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

/**
 * The log can reach a few hundred kilobytes, and events arrive steadily through
 * an agent's turn, so it is held in memory and written on a timer rather than
 * read, parsed and serialised once per event on the main thread.
 */
let collected: AgentTraceEvent[] | undefined;
let unflushed = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function flush(): void {
  if (flushTimer !== undefined) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  if (!collected || !unflushed) return;
  write(collected);
  unflushed = false;
}

function scheduleFlush(): void {
  if (flushTimer !== undefined) return;
  flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

const isIn = (scope: TraceScope) => (event: AgentTraceEvent) =>
  event.scope?.sessionId === scope.sessionId;

export function readAgentTraceLog(scope?: TraceScope): AgentTraceEvent[] {
  flush();
  const events = read();
  return scope ? events.filter(isIn(scope)) : events;
}

/** Clears what the reader was shown; without a scope, the whole log. */
export function clearAgentTraceLog(scope?: TraceScope): void {
  flush();

  if (scope) {
    const kept = read().filter((event) => !isIn(scope)(event));
    write(kept);
    if (collected) collected = kept;
    return;
  }

  if (collected) collected = [];
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
  collected = read();
  unflushed = false;

  const unsubscribe = subscribeToTraceEvents((event) => {
    collected = [...(collected ?? []), event].slice(-MAX_EVENTS);
    unflushed = true;
    scheduleFlush();
  });

  // A tab closed mid-turn would otherwise lose up to a flush window of the
  // trace, which is the part worth reading after a crash.
  const flushBeforeUnload = () => flush();
  window.addEventListener("pagehide", flushBeforeUnload);

  return () => {
    unsubscribe();
    window.removeEventListener("pagehide", flushBeforeUnload);
    flush();
    collected = undefined;
  };
}
