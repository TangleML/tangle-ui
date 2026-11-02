import { readTextFile, type TextFileReadFailure } from "@/utils/textFile";

const MAX_DOCUMENT_FILE_MB = 1;
const MAX_DOCUMENT_FILE_BYTES = MAX_DOCUMENT_FILE_MB * 1024 * 1024;

type DocumentFileReadResult =
  { ok: true; title: string; content: string } | { ok: false; error: string };

function failureMessage(reason: TextFileReadFailure, fileName: string) {
  switch (reason) {
    case "too_large":
      return `${fileName} is larger than ${MAX_DOCUMENT_FILE_MB} MB.`;
    case "not_text":
      return `${fileName} isn't a text file. Only text can be added as a document.`;
    case "unreadable":
      return `Couldn't read ${fileName}.`;
  }
}

export async function readDocumentFile(
  file: File,
): Promise<DocumentFileReadResult> {
  const result = await readTextFile(file, {
    maxBytes: MAX_DOCUMENT_FILE_BYTES,
  });

  return result.ok
    ? { ok: true, title: file.name, content: result.text }
    : { ok: false, error: failureMessage(result.reason, file.name) };
}
