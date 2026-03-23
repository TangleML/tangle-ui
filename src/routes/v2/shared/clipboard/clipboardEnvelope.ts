import type {
  BindingSnapshot,
  NodeSnapshot,
} from "@/routes/v2/shared/nodes/types";

const CLIPBOARD_ENVELOPE_TYPE = "tangle-pipeline-nodes";

interface ClipboardEnvelope {
  _type: typeof CLIPBOARD_ENVELOPE_TYPE;
  snapshots: NodeSnapshot[];
  bindings: BindingSnapshot[];
}

function isClipboardEnvelope(data: unknown): data is ClipboardEnvelope {
  return (
    typeof data === "object" &&
    data !== null &&
    "_type" in data &&
    (data as Record<string, unknown>)._type === CLIPBOARD_ENVELOPE_TYPE
  );
}

export async function writeToSystemClipboard(
  snapshots: NodeSnapshot[],
  bindings: BindingSnapshot[],
) {
  try {
    const envelope: ClipboardEnvelope = {
      _type: CLIPBOARD_ENVELOPE_TYPE,
      snapshots,
      bindings,
    };
    await navigator.clipboard.writeText(JSON.stringify(envelope));
  } catch {
    // System clipboard may be unavailable (permissions, insecure context)
  }
}

export async function readFromSystemClipboard(): Promise<ClipboardEnvelope | null> {
  try {
    const text = await navigator.clipboard.readText();
    const parsed = JSON.parse(text);
    if (isClipboardEnvelope(parsed)) return parsed;
  } catch {
    // Not pipeline data or clipboard unavailable
  }
  return null;
}
