/**
 * Adds the agent's own account of a turn to the trace.
 *
 * Lifecycle hooks report the calls but never the reasoning between them, which
 * is the half that says why a turn went the way it did. The run result carries
 * both as items, so they are read once the turn ends — there is no lifecycle
 * event for either, and streaming the turn would mean rebuilding how every
 * agent here is run.
 *
 * A model that returns no reasoning (or a provider that withholds it) simply
 * contributes nothing.
 */
import { recordTraceEvent, truncateForTrace } from "./agentTrace";

interface TextPart {
  text?: unknown;
}

function textOf(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part: TextPart) => (typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function recordTurnReasoning(
  agentName: string,
  items: readonly unknown[] | undefined,
): void {
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const { type, rawItem } = (item ?? {}) as {
      type?: string;
      rawItem?: { content?: unknown; rawContent?: unknown };
    };

    if (type === "reasoning_item") {
      const text = textOf(rawItem?.rawContent) || textOf(rawItem?.content);
      if (text) {
        recordTraceEvent({
          at: Date.now(),
          agent: agentName,
          kind: "thought",
          label: "reasoning",
          detail: truncateForTrace(text),
        });
      }
    }

    if (type === "message_output_item") {
      const text = textOf(rawItem?.content);
      if (text) {
        recordTraceEvent({
          at: Date.now(),
          agent: agentName,
          kind: "message",
          label: "reply",
          detail: truncateForTrace(text),
        });
      }
    }
  }
}
