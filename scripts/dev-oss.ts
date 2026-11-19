#!/usr/bin/env node
//
// One-shot local OSS dev environment: Tangle + Tangent.
//
// Orchestrates four stages:
//   1. Set up and run Tangent (the tangent-shell sibling repo).
//   2. Seed the `tangle-oss` agent bundle into Tangent's marketplace.
//   3. Ensure the Tangle API has an active workspace pointing at local Tangent.
//   4. Launch tangle-ui (dev) with the Projects/Tangent beta flags on.
//
// Tangent runs in the background; tangle-ui runs in the foreground. Ctrl-C (or
// any exit) tears the background Tangent processes down.
//
// All ports and paths are env-overridable; see the Config block below. Secrets
// (PI_PROXY_URL / PI_PROXY_API_KEY) are read from the environment and written
// into tangent-shell/.env so Tangent's `pi` agents can reach an LLM proxy.
//
// Cross-platform: runs on macOS, Linux, and Windows via tsx. Usage:
//   PI_PROXY_URL=https://proxy... PI_PROXY_API_KEY=sk-... pnpm oss:dev

import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const isWindows = process.platform === "win32";

const env = process.env;

const UI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TANGENT_DIR =
  env.TANGENT_DIR ?? path.resolve(UI_DIR, "..", "tangent-shell");
const TANGENT_REPO_URL =
  env.TANGENT_REPO_URL ?? "https://github.com/TangleML/tangent-shell";

const TANGENT_SERVER_URL = env.TANGENT_SERVER_URL ?? "http://localhost:8787";
const TANGENT_WEB_URL = env.TANGENT_WEB_URL ?? "http://localhost:5173";
const TANGLE_API_URL = env.TANGLE_API_URL ?? "http://localhost:8000";
const TANGLE_UI_PORT = env.TANGLE_UI_PORT ?? "3000";
const BUNDLE_ID = env.BUNDLE_ID ?? "tangle-oss";

// Where the workspace-create request goes. The generated tangle-ui client only
// exposes GET /api/workspaces/, so the create path/body are best-guess and kept
// overridable in case the backend contract differs.
const WORKSPACE_CREATE_PATH = env.WORKSPACE_CREATE_PATH ?? "/api/workspaces/";
const WORKSPACE_NAME = env.WORKSPACE_NAME ?? "Local";
const WORKSPACE_CREATE_BODY = env.WORKSPACE_CREATE_BODY ?? "";

const PI_PROXY_URL = env.PI_PROXY_URL ?? "";
const PI_PROXY_API_KEY = env.PI_PROXY_API_KEY ?? "";

const HEALTH_TIMEOUT = Number(env.HEALTH_TIMEOUT ?? "120");

const info = (msg: string) => console.log(`\x1b[1;34m[dev-oss]\x1b[0m ${msg}`);
const warn = (msg: string) =>
  console.error(`\x1b[1;33m[dev-oss] WARN:\x1b[0m ${msg}`);
const err = (msg: string) =>
  console.error(`\x1b[1;31m[dev-oss] ERROR:\x1b[0m ${msg}`);

let tangentProc: ChildProcess | null = null;
let tangentExit: { code: number | null; signal: NodeJS.Signals | null } | null =
  null;
let cleanedUp = false;

function killTree(proc: ChildProcess): void {
  const pid = proc.pid;
  if (!pid) {
    return;
  }
  if (isWindows) {
    spawn(`taskkill /PID ${pid} /T /F`, { stdio: "ignore", shell: true });
    return;
  }
  // The background process was detached into its own group, so a negative PID
  // signals the whole tree (pnpm dev -> vite servers) in one shot.
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process already gone; nothing to tear down.
    }
  }
}

function cleanup(): void {
  if (cleanedUp) {
    return;
  }
  cleanedUp = true;
  if (tangentProc) {
    info(`Stopping Tangent (pid ${tangentProc.pid})...`);
    killTree(tangentProc);
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});
process.on("exit", cleanup);

function run(
  command: string,
  args: string[],
  cwd: string,
  extraEnv?: Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn([command, ...args].join(" "), {
      cwd,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, ...extraEnv },
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} ${args.join(" ")} exited with ${signal ?? code}`,
          ),
        );
      }
    });
  });
}

function spawnBackground(
  command: string,
  args: string[],
  cwd: string,
): ChildProcess {
  return spawn([command, ...args].join(" "), {
    cwd,
    stdio: "inherit",
    shell: true,
    detached: !isWindows,
    env: { ...process.env },
  });
}

function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = isWindows ? `where ${cmd}` : `command -v ${cmd}`;
    const child = spawn(probe, { stdio: "ignore", shell: true });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

async function requireCmd(cmd: string): Promise<void> {
  if (!(await commandExists(cmd))) {
    err(`'${cmd}' is required but not found on PATH.`);
    process.exit(1);
  }
}

async function pathExists(
  target: string,
  kind: "file" | "dir",
): Promise<boolean> {
  try {
    const stat = await fs.stat(target);
    return kind === "file" ? stat.isFile() : stat.isDirectory();
  } catch {
    return false;
  }
}

async function setEnvVar(
  file: string,
  key: string,
  value: string,
): Promise<void> {
  const content = (await pathExists(file, "file"))
    ? await fs.readFile(file, "utf8")
    : "";
  const lines = content.length ? content.split("\n") : [];
  if (lines.length && lines[lines.length - 1] === "") {
    lines.pop();
  }
  const prefix = `${key}=`;
  const filtered = lines.filter((line) => !line.startsWith(prefix));
  filtered.push(`${key}=${value}`);
  await fs.writeFile(file, `${filtered.join("\n")}\n`);
}

async function urlOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForUrl(
  url: string,
  label: string,
  abortReason?: () => string | null,
): Promise<boolean> {
  const deadline = Date.now() + HEALTH_TIMEOUT * 1000;
  info(`Waiting for ${label} (${url})...`);
  while (Date.now() < deadline) {
    const reason = abortReason?.();
    if (reason) {
      err(reason);
      return false;
    }
    if (await urlOk(url)) {
      info(`${label} is up.`);
      return true;
    }
    await sleep(2000);
  }
  return false;
}

function extractTotalCount(data: unknown): number {
  if (typeof data === "object" && data !== null && "total_count" in data) {
    const value = data.total_count;
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
  }
  return 0;
}

async function promptYesNo(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return false;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function ensureTangentRepo(): Promise<void> {
  if (await pathExists(TANGENT_DIR, "dir")) {
    return;
  }

  warn(`Tangent repo not found at: ${TANGENT_DIR}`);
  const shouldClone = await promptYesNo(
    `Clone ${TANGENT_REPO_URL} into ${TANGENT_DIR}?`,
  );
  if (!shouldClone) {
    err("Clone it next to tangle-ui or set TANGENT_DIR:");
    err(`  git clone ${TANGENT_REPO_URL} '${TANGENT_DIR}'`);
    process.exit(1);
  }

  await requireCmd("git");
  info(`Cloning Tangent into ${TANGENT_DIR}...`);
  await run("git", ["clone", TANGENT_REPO_URL, `"${TANGENT_DIR}"`], UI_DIR);
}

async function preflight(): Promise<void> {
  info("Preflight checks...");
  await requireCmd("node");
  await requireCmd("pnpm");

  await ensureTangentRepo();

  if (!(await commandExists("pi")) && !env.PI_BIN) {
    warn(
      "'pi' agent binary not on PATH (set PI_BIN). Tangent will boot but agents cannot respond.",
    );
  }
  if (!PI_PROXY_URL || !PI_PROXY_API_KEY) {
    warn(
      "PI_PROXY_URL / PI_PROXY_API_KEY not set. Tangent agents need an LLM proxy to reply.",
    );
  }
}

async function startTangent(): Promise<void> {
  if (await urlOk(`${TANGENT_SERVER_URL}/api/agent-bundles`)) {
    info(
      `Tangent server already running at ${TANGENT_SERVER_URL}; reusing it.`,
    );
    return;
  }

  const envFile = path.join(TANGENT_DIR, ".env");
  if (!(await pathExists(envFile, "file"))) {
    info(`Creating ${envFile} from .env.example`);
    await fs.copyFile(path.join(TANGENT_DIR, ".env.example"), envFile);
  }
  await setEnvVar(envFile, "TANGLE_API_URL", TANGLE_API_URL);
  await setEnvVar(envFile, "TANGLE_BASE_URL", TANGLE_API_URL);
  await setEnvVar(envFile, "VITE_DEFAULT_SESSION_BUNDLE_ID", BUNDLE_ID);
  if (PI_PROXY_URL) {
    await setEnvVar(envFile, "PI_PROXY_URL", PI_PROXY_URL);
  }
  if (PI_PROXY_API_KEY) {
    await setEnvVar(envFile, "PI_PROXY_API_KEY", PI_PROXY_API_KEY);
  }

  info("Installing Tangent dependencies (pnpm install)...");
  await run("pnpm", ["install"], TANGENT_DIR);

  // Stage 2 (seed): idempotent -- a no-op once the marketplace is populated, and
  // duplicate ZIPs are skipped. Seeds every examples/<id>/ bundle, incl. tangle-oss.
  info(`Seeding agent bundles (incl. ${BUNDLE_ID})...`);
  await run("pnpm", ["seed"], TANGENT_DIR);

  info(
    `Starting Tangent (pnpm dev): server ${TANGENT_SERVER_URL}, web ${TANGENT_WEB_URL}`,
  );
  tangentProc = spawnBackground("pnpm", ["dev"], TANGENT_DIR);
  tangentProc.on("exit", (code, signal) => {
    tangentExit = { code, signal };
    tangentProc = null;
  });

  const tangentDied = (): string | null => {
    if (!tangentExit) {
      return null;
    }
    const status = tangentExit.signal ?? tangentExit.code;
    return (
      `Tangent (pnpm dev) exited (${status}) before becoming healthy; see its logs above. ` +
      `A common cause is a native module (e.g. better-sqlite3) built for a different Node.js ` +
      `version. Try: (cd "${TANGENT_DIR}" && pnpm rebuild)`
    );
  };

  if (
    !(await waitForUrl(
      `${TANGENT_SERVER_URL}/api/agent-bundles`,
      "Tangent server",
      tangentDied,
    ))
  ) {
    err(`Tangent server did not become healthy within ${HEALTH_TIMEOUT}s.`);
    process.exit(1);
  }
  if (!(await waitForUrl(TANGENT_WEB_URL, "Tangent web"))) {
    err(`Tangent web did not become healthy within ${HEALTH_TIMEOUT}s.`);
    process.exit(1);
  }
}

async function ensureWorkspace(): Promise<void> {
  if (!(await waitForUrl(`${TANGLE_API_URL}/services/ping`, "Tangle API"))) {
    warn(
      `Tangle API not reachable at ${TANGLE_API_URL}; skipping workspace setup.`,
    );
    warn(
      "Start the Tangle backend (github.com/TangleML/tangle) and re-run, or set TANGLE_API_URL.",
    );
    return;
  }

  let count = 0;
  try {
    const res = await fetch(`${TANGLE_API_URL}/api/workspaces/`);
    if (res.ok) {
      count = extractTotalCount(await res.json());
    }
  } catch {
    count = 0;
  }

  if (count > 0) {
    info(`Tangle already has ${count} workspace(s).`);
    info(
      `In dev, tangle-ui falls back to ${TANGENT_WEB_URL} when a workspace has no tangentBaseUrl.`,
    );
    return;
  }

  const body =
    WORKSPACE_CREATE_BODY ||
    JSON.stringify({
      name: WORKSPACE_NAME,
      description: "Local OSS workspace",
      is_active: true,
      data: { tangentBaseUrl: TANGENT_WEB_URL },
    });

  info(
    `No workspaces found; creating one at ${TANGLE_API_URL}${WORKSPACE_CREATE_PATH}`,
  );
  let code = 0;
  try {
    const res = await fetch(`${TANGLE_API_URL}${WORKSPACE_CREATE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    code = res.status;
    const text = await res.text();
    if (text) {
      console.log(text);
    }
  } catch (error) {
    warn(
      `Workspace create request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (code === 200 || code === 201) {
    info(`Workspace created (HTTP ${code}).`);
    return;
  }
  warn(`Workspace create returned HTTP ${code}.`);
  warn(
    "The generated client only documents GET /api/workspaces/, so this backend may create",
  );
  warn(
    "workspaces differently. Ensure >=1 active workspace exists by other means.",
  );
  warn(
    `Dev fallback: tangle-ui still resolves Tangent to ${TANGENT_WEB_URL} when no tangentBaseUrl is set.`,
  );
}

async function startUi(): Promise<void> {
  const envFile = path.join(UI_DIR, ".env");
  if (!(await pathExists(envFile, "file"))) {
    await fs.writeFile(envFile, "");
  }

  // Projects + Tangent beta flags default to on in src/flags.ts. VITE_ENABLE_TANGENT
  // keeps the Tangent flag's Settings toggle unlocked (its build-time canEnable gate).
  await setEnvVar(envFile, "VITE_ENABLE_TANGENT", "true");
  await setEnvVar(envFile, "VITE_BACKEND_API_URL", TANGLE_API_URL);

  info("Installing tangle-ui dependencies (pnpm install)...");
  await run("pnpm", ["install"], UI_DIR);

  info(
    `Starting tangle-ui at http://localhost:${TANGLE_UI_PORT} (dev). Ctrl-C stops everything.`,
  );
  info(
    `Tangent embeds from ${TANGENT_WEB_URL}; Tangle API at ${TANGLE_API_URL}`,
  );
  // Foreground so the signal/exit handlers still tear Tangent down on Ctrl-C.
  await run("pnpm", ["start"], UI_DIR, { TANGLE_UI_PORT });
}

async function main(): Promise<void> {
  try {
    await preflight();
    await startTangent();
    await ensureWorkspace();
    await startUi();
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    cleanup();
    process.exit(1);
  }
}

void main();
