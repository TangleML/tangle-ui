const MAX_DOCUMENT_FILE_MB = 1;
const MAX_DOCUMENT_FILE_BYTES = MAX_DOCUMENT_FILE_MB * 1024 * 1024;

type DocumentFileReadResult =
  { ok: true; title: string; content: string } | { ok: false; error: string };

function decodeText(bytes: ArrayBuffer): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return text.includes("\0") ? null : text;
  } catch {
    return null;
  }
}

export async function readDocumentFile(
  file: File,
): Promise<DocumentFileReadResult> {
  if (file.size > MAX_DOCUMENT_FILE_BYTES) {
    return {
      ok: false,
      error: `${file.name} is larger than ${MAX_DOCUMENT_FILE_MB} MB.`,
    };
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    return { ok: false, error: `Couldn't read ${file.name}.` };
  }

  const content = decodeText(bytes);
  if (content === null) {
    return {
      ok: false,
      error: `${file.name} isn't a text file. Only text can be added as a document.`,
    };
  }

  return { ok: true, title: file.name, content };
}
