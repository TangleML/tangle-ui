const PLAIN_TEXT = "plaintext";

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  md: "markdown",
  markdown: "markdown",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  py: "python",
  sh: "shell",
  sql: "sql",
  ts: "typescript",
  js: "javascript",
};

/**
 * A document is named by whoever wrote it, not by a file picker, so the
 * extension is a hint and often absent. Anything unrecognised reads as plain
 * text rather than being guessed at and mis-highlighted.
 */
export function languageFor(name: string | null | undefined): string {
  const extension = name?.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXTENSION[extension] ?? PLAIN_TEXT;
}
