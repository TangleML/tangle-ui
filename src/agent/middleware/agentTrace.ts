// Recording happens inside the agent Web Worker, one per pipeline tab plus one
// for the project, so a buffer held there is only ever a fraction of a session.
// Events are broadcast instead and collected by {@link startAgentTraceLog} on
// the main thread, the only side that can reach `localStorage`.
const CHANNEL = "tangle:agent-trace";
const MAX_PAYLOAD_CHARS = 2000;

export interface AgentTraceEvent {
  at: number;
  agent: string;
  kind:
    | "turn-start"
    | "turn-end"
    | "tool-start"
    | "tool-end"
    | "tool-hung"
    | "thought"
    | "message";
  label: string;
  detail?: string;
  durationMs?: number;
}

let channel: BroadcastChannel | undefined;

function getChannel(): BroadcastChannel | undefined {
  if (typeof BroadcastChannel === "undefined") return undefined;
  channel ??= new BroadcastChannel(CHANNEL);
  return channel;
}

export function truncateForTrace(value: string): string {
  return value.length > MAX_PAYLOAD_CHARS
    ? `${value.slice(0, MAX_PAYLOAD_CHARS)}… (${value.length} chars)`
    : value;
}

export function recordTraceEvent(event: AgentTraceEvent): void {
  getChannel()?.postMessage(event);
}

/**
 * A `BroadcastChannel` never delivers to the instance that posted, so the
 * listener owns one of its own — otherwise nothing recorded on this thread
 * would ever be seen on it.
 */
export function subscribeToTraceEvents(
  onEvent: (event: AgentTraceEvent) => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};

  const listening = new BroadcastChannel(CHANNEL);
  listening.onmessage = (message: MessageEvent<AgentTraceEvent>) =>
    onEvent(message.data);
  return () => listening.close();
}
