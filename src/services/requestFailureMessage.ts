const MAX_REASONS = 3;
const MAX_VALUE_LENGTH = 40;

interface ValidationIssue {
  loc?: unknown;
  msg?: unknown;
  input?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** `["body", "root_task", "spec", "inputs", 0, "default"]` reads as a path. */
function fieldPath(loc: unknown): string | undefined {
  if (!Array.isArray(loc)) return undefined;
  const parts = loc
    .filter((part) => part !== "body")
    .map((part) => String(part));
  return parts.length > 0 ? parts.join(".") : undefined;
}

function describeValue(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  const rendered =
    typeof input === "string" ? `"${input}"` : JSON.stringify(input);
  if (rendered === undefined) return undefined;
  return rendered.length > MAX_VALUE_LENGTH
    ? `${rendered.slice(0, MAX_VALUE_LENGTH)}…`
    : rendered;
}

function describeIssue(issue: ValidationIssue): string | undefined {
  const message = typeof issue.msg === "string" ? issue.msg : undefined;
  if (!message) return undefined;

  const path = fieldPath(issue.loc);
  const value = describeValue(issue.input);
  const suffix = value ? ` (got ${value})` : "";
  return path ? `${path}: ${message}${suffix}` : `${message}${suffix}`;
}

function describeDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return undefined;

  const reasons = detail
    .filter(isRecord)
    .map(describeIssue)
    .filter((reason): reason is string => reason !== undefined);
  if (reasons.length === 0) return undefined;

  const shown = reasons.slice(0, MAX_REASONS).join("; ");
  const hidden = reasons.length - MAX_REASONS;
  return hidden > 0 ? `${shown} (and ${hidden} more)` : shown;
}

/**
 * What the server said, added to what we were doing.
 *
 * A rejected request usually explains itself — a 422 names the field it would
 * not accept and the value it was given — and that explanation was being
 * dropped for a fixed sentence. What reads the message may be an agent about to
 * decide whether to correct the request or give up on it, so the difference
 * between "Failed to create pipeline run" and the field that was wrong is the
 * difference between a fix and a dead end.
 */
export async function requestFailureMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const said = await readServerMessage(response);
  const status = `${response.status} ${response.statusText}`.trim();
  return said ? `${fallback} (${status}): ${said}` : `${fallback} (${status})`;
}

async function readServerMessage(
  response: Response,
): Promise<string | undefined> {
  const body = await response.text().catch(() => "");
  if (!body) return undefined;

  try {
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) return body.trim() || undefined;
    return (
      describeDetail(parsed.detail) ??
      (typeof parsed.message === "string" ? parsed.message : undefined) ??
      body.trim()
    );
  } catch {
    return body.trim() || undefined;
  }
}
