const ATTRIBUTION_SOURCE = "tangent";

export interface CliTarget {
  apiBaseUrl: string;
}

/**
 * Environment the CLI needs to reach the same deployment the extension's REST
 * views use. `TANGLE_API_BASE_URL` selects the target; auth is deliberately
 * left to the CLI's own mechanism (Minerva locally, or a `TANGLE_AUTH` the user
 * already exports), since that is a `username:password` basic-auth credential
 * rather than the REST bearer token the extension stores.
 */
export function buildCliEnv({ apiBaseUrl }: CliTarget): Record<string, string> {
  return {
    TANGLE_API_BASE_URL: apiBaseUrl,
    TANGLE_DEPLOY_SOURCE: ATTRIBUTION_SOURCE,
  };
}

/** POSIX single-quote so a path with spaces or metacharacters stays one argument. */
export function shellQuote(arg: string): string {
  if (arg !== "" && /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export function formatCommandLine(bin: string, args: string[]): string {
  return [bin, ...args].map(shellQuote).join(" ");
}

/** `--args` wants a JSON object string; reject anything that is not one. */
export function parseArgsJson(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "") return "{}";
  const parsed: unknown = JSON.parse(trimmed);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Pipeline arguments must be a JSON object.");
  }
  return JSON.stringify(parsed);
}
