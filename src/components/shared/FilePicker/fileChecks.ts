import { NotTextFileError, readTextFromFile } from "@/utils/dom";

export type Accept = readonly string[] | "any";

export const YAML_FILE_ACCEPT: readonly string[] = [".yaml", ".yml"];

export const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;

export type FileCheckReason = "extension" | "size" | "not-text" | "unreadable";

export class FileCheckError extends Error {
  readonly reason: FileCheckReason;
  readonly file: File;

  constructor(reason: FileCheckReason, file: File, message: string) {
    super(message);
    this.name = "FileCheckError";
    this.reason = reason;
    this.file = file;
    Object.setPrototypeOf(this, FileCheckError.prototype);
  }
}

type FileCheckMessage = (file: File, opts: FileCheckOptions) => string;

export type FileCheckMessages = Partial<
  Record<FileCheckReason, FileCheckMessage>
>;

export interface FileCheckOptions {
  accept: Accept;
  maxBytes: number | null;
  requireText: boolean;
  messages?: FileCheckMessages;
}

const BYTE_UNITS = ["B", "KB", "MB", "GB"];

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${BYTE_UNITS[unitIndex]}`;
}

function acceptList(accept: Accept): string {
  return accept === "any" ? "" : accept.join(" or ");
}

const DEFAULT_MESSAGES: Record<FileCheckReason, FileCheckMessage> = {
  extension: (file, opts) =>
    `${file.name} isn't a ${acceptList(opts.accept)} file.`,
  size: (file, opts) =>
    `${file.name} is larger than ${formatBytes(opts.maxBytes ?? 0)}.`,
  "not-text": (file) => `${file.name} isn't a text file.`,
  unreadable: (file) => `Couldn't read ${file.name}.`,
};

function fileCheckError(
  reason: FileCheckReason,
  file: File,
  opts: FileCheckOptions,
): FileCheckError {
  const message = (opts.messages?.[reason] ?? DEFAULT_MESSAGES[reason])(
    file,
    opts,
  );
  return new FileCheckError(reason, file, message);
}

export function matchesAccept(file: File, accept: Accept): boolean {
  if (accept === "any") return true;
  const name = file.name.toLowerCase();
  return accept.some((extension) => name.endsWith(extension.toLowerCase()));
}

export function checkFile(
  file: File,
  opts: FileCheckOptions,
): FileCheckError | null {
  if (!matchesAccept(file, opts.accept)) {
    return fileCheckError("extension", file, opts);
  }
  if (opts.maxBytes !== null && file.size > opts.maxBytes) {
    return fileCheckError("size", file, opts);
  }
  return null;
}

export async function readCheckedText(
  file: File,
  opts: FileCheckOptions,
): Promise<string> {
  const checkError = checkFile(file, opts);
  if (checkError) throw checkError;

  try {
    return opts.requireText ? await readTextFromFile(file) : await file.text();
  } catch (error) {
    if (error instanceof NotTextFileError) {
      throw fileCheckError("not-text", file, opts);
    }
    throw fileCheckError("unreadable", file, opts);
  }
}
