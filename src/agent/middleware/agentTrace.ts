/**
 * A bounded record of what an agent did, kept in the worker that ran it.
 *
 * The status line is one string each event overwrites, so it says what an
 * agent is doing and never what it did — and a sub-agent's tool calls cross a
 * Comlink bridge that keeps nothing. Without this, a loop, a stale entity id
 * and a tool that never returns are indistinguishable from working.
 *
 * It stays in the worker and is read on demand rather than pushed per event:
 * a turn can make hundreds of calls, and the UI needs them only when someone
 * opens the log.
 */
const MAX_EVENTS = 500;
const MAX_PAYLOAD_CHARS = 2000;

export interface AgentTraceEvent {
  at: number;
  agent: string;
  kind: "turn-start" | "turn-end" | "tool-start" | "tool-end" | "tool-hung";
  label: string;
  detail?: string;
  durationMs?: number;
}

const events: AgentTraceEvent[] = [];

export function truncateForTrace(value: string): string {
  return value.length > MAX_PAYLOAD_CHARS
    ? `${value.slice(0, MAX_PAYLOAD_CHARS)}… (${value.length} chars)`
    : value;
}

export function recordTraceEvent(event: AgentTraceEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

export function readTraceEvents(): AgentTraceEvent[] {
  return events.slice();
}

export function clearTraceEvents(): void {
  events.length = 0;
}
