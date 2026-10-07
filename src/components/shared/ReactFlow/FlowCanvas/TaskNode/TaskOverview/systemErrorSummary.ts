const MAX_LENGTH = 500;

const FRAME = /^[ \t]+File "/;

const stripModulePath = (exception: string) =>
  exception.replace(/^[A-Za-z_][\w.]*\.(\w+)(?=:|\n|$)/, "$1");

const cap = (text: string) =>
  text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH).trimEnd()}…` : text;

/**
 * The actionable line of a Python traceback: the final exception of the chain,
 * with its module path dropped, for display above the full text.
 */
export const getSystemErrorSummary = (
  systemErrorExceptionFull?: string | null,
): string | null => {
  const text = systemErrorExceptionFull?.trim();
  if (!text) return null;

  const lines = text.split("\n");
  const lastFrame = lines.findLastIndex((line) => FRAME.test(line));

  // The API serves `orchestration_error_message` in this same field when there is
  // no traceback, and that is already a plain sentence.
  if (lastFrame === -1) return cap(text);

  // The final exception starts at the first unindented line after its innermost
  // frame. Scanning from that frame rather than the whole text is what stops an
  // earlier `__cause__` from winning when its own message is multi-line.
  const after = lines.slice(lastFrame + 1);
  const start = after.findIndex((line) => line !== "" && !/^\s/.test(line));
  if (start === -1) return null;

  return cap(stripModulePath(after.slice(start).join("\n").trim()));
};
