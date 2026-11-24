import "@tangent/local-agent-host/loadEnv.ts";

import { render } from "ink";

import { loadConfig, resetConnection } from "./config.ts";
import { App } from "./ui/App.tsx";

const USAGE = `Usage: tangent-tui [options]

A terminal client for Tangent Projects: connect to a Tangle instance, open a
project, and chat with Prime. A local agent host is started for the project so
Prime can spawn local sub-agents and read files in the current directory.

Options:
  --reset      Forget the saved instance and SSO sign-in, then reconnect.
  -h, --help   Show this help.

Okta SSO config (OKTASSO_* and AUTH_JWT_TOKEN_COOKIE_NAME) is read from the
environment or a .env in the current directory, matching tangent-local-agent.`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(USAGE);
    return;
  }
  const doReset = argv.includes("--reset");
  if (doReset) await resetConnection();
  const config = doReset ? null : await loadConfig();
  process.stdout.write(ENTER_ALT_SCREEN);
  try {
    const { waitUntilExit } = render(<App initialConfig={config} />);
    await waitUntilExit();
  } finally {
    process.stdout.write(LEAVE_ALT_SCREEN);
  }
}

const ENTER_ALT_SCREEN = "\x1b[?1049h";
const LEAVE_ALT_SCREEN = "\x1b[?1049l";

main().catch((err: unknown) => {
  console.error(
    `tangent-tui: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exitCode = 1;
});
