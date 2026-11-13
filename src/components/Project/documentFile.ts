import { NotTextFileError, readTextFromFile } from "@/utils/dom";

const MAX_DOCUMENT_FILE_MB = 1;
const MAX_DOCUMENT_FILE_BYTES = MAX_DOCUMENT_FILE_MB * 1024 * 1024;

type DocumentFileReadResult =
  { ok: true; title: string; content: string } | { ok: false; error: string };

function readFailureMessage(error: unknown, fileName: string) {
  return error instanceof NotTextFileError
    ? `${fileName} isn't a text file. Only text can be added as a document.`
    : `Couldn't read ${fileName}.`;
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

  try {
    const content = await readTextFromFile(file);
    return { ok: true, title: file.name, content };
  } catch (error) {
    return { ok: false, error: readFailureMessage(error, file.name) };
  }
}
