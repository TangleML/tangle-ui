export type TextFileReadFailure = "too_large" | "not_text" | "unreadable";

type TextFileReadResult =
  { ok: true; text: string } | { ok: false; reason: TextFileReadFailure };

function decodeText(bytes: ArrayBuffer): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    // Binary formats can still decode as valid UTF-8, but text never holds NUL.
    return text.includes("\0") ? null : text;
  } catch {
    return null;
  }
}

export async function readTextFile(
  file: File,
  { maxBytes = Infinity }: { maxBytes?: number } = {},
): Promise<TextFileReadResult> {
  if (file.size > maxBytes) return { ok: false, reason: "too_large" };

  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  const text = decodeText(bytes);
  return text === null ? { ok: false, reason: "not_text" } : { ok: true, text };
}
