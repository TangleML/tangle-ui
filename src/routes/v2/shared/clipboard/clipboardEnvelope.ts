import type {
  BindingSnapshot,
  NodeSnapshot,
} from "@/routes/v2/shared/nodes/types";

const CLIPBOARD_ENVELOPE_TYPE = "tangle-pipeline-nodes";

export interface ClipboardEnvelope {
  _type: typeof CLIPBOARD_ENVELOPE_TYPE;
  snapshots: NodeSnapshot[];
  bindings: BindingSnapshot[];
}

function isClipboardEnvelope(data: unknown): data is ClipboardEnvelope {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return (
    candidate._type === CLIPBOARD_ENVELOPE_TYPE &&
    Array.isArray(candidate.snapshots) &&
    Array.isArray(candidate.bindings)
  );
}

function parseEnvelope(text: string): ClipboardEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isClipboardEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export type SystemClipboardInfo =
  | { kind: "envelope"; envelope: ClipboardEnvelope }
  | { kind: "text"; text: string }
  | { kind: "empty" }
  | { kind: "unavailable" };

function classify(text: string): SystemClipboardInfo {
  if (!text) return { kind: "empty" };
  const envelope = parseEnvelope(text);
  return envelope ? { kind: "envelope", envelope } : { kind: "text", text };
}

/**
 * Unlike `readSystemClipboardInfo`, `ClipboardEvent.clipboardData` needs no
 * clipboard-read permission — the only route that works without a prompt in
 * Chrome and at all in Firefox, so the only one that makes cross-tab paste
 * viable.
 */
export function readPasteEventClipboardInfo(
  event: ClipboardEvent,
): SystemClipboardInfo {
  if (!event.clipboardData) return { kind: "unavailable" };
  return classify(event.clipboardData.getData("text/plain"));
}

export async function readSystemClipboardInfo(): Promise<SystemClipboardInfo> {
  try {
    return classify(await navigator.clipboard.readText());
  } catch {
    return { kind: "unavailable" };
  }
}

/** Rejects when the clipboard is unwritable, so callers can tell the user. */
export async function writeToSystemClipboard(
  snapshots: NodeSnapshot[],
  bindings: BindingSnapshot[],
): Promise<void> {
  const envelope: ClipboardEnvelope = {
    _type: CLIPBOARD_ENVELOPE_TYPE,
    snapshots,
    bindings,
  };
  await navigator.clipboard.writeText(JSON.stringify(envelope));
}
