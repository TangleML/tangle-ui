import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { object, optional, safeParse, string } from "zod/mini";

export interface TuiConfig {
  /** Base URL of the Tangle instance API (e.g. https://oasis-staging.shopify.io). */
  apiUrl: string;
  /** Base URL of the Tangle web UI, used by the `/web` handoff. */
  uiUrl: string;
  /** The project opened last, re-offered on the next launch. */
  lastProjectId?: string;
}

const configSchema = object({
  apiUrl: string(),
  uiUrl: string(),
  lastProjectId: optional(string()),
});

const CONFIG_DIR = path.join(
  process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
  "tangent-tui",
);
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// The SSO cookie cache @tangent/local-agent-host writes; a reset clears it so
// the next connect re-runs the Okta login.
const OKTASSO_CACHE_FILE = path.join(
  os.homedir(),
  ".cache",
  "tangle-deploy",
  "oktasso_token.json",
);

export async function loadConfig(): Promise<TuiConfig | null> {
  let raw: string;
  try {
    raw = await readFile(CONFIG_FILE, "utf8");
  } catch {
    return null;
  }
  const parsed = safeParse(configSchema, safeJsonParse(raw));
  return parsed.success ? parsed.data : null;
}

export async function saveConfig(config: TuiConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
}

export async function resetConnection(): Promise<void> {
  await rm(CONFIG_FILE, { force: true });
  await rm(OKTASSO_CACHE_FILE, { force: true });
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
