import type { SubagentInfo } from "@tangent/shared/contracts.ts";

import type { TuiConfig } from "../config.ts";
import type { LocalAgentHostHandle } from "../localAgentHost.ts";
import type { ShellClient } from "../shellClient.ts";
import type { Project, TangleRestClient } from "../tangleRestClient.ts";

/** Everything a slash command can read or act on, supplied by the chat screen. */
export interface CommandContext {
  /** Writes a line into the chat screen's system log. */
  print: (line: string) => void;
  config: TuiConfig;
  project: Project;
  shellUrl: string;
  sessionId: string;
  subagents: SubagentInfo[];
  tangle: TangleRestClient;
  shell: ShellClient;
  host: LocalAgentHostHandle;
  userEmail?: string;
  /** Opens a path under the instance's web UI in the browser. */
  openWeb: (path: string) => Promise<void>;
  /** Returns to the session list to start or pick another session. */
  goToSessions: () => void;
  /** Forgets the stored connection and SSO cookie, back to the connect screen. */
  reset: () => Promise<void>;
}

export interface SlashCommand {
  /** Invoked as `/name`. */
  name: string;
  description: string;
  run: (ctx: CommandContext, args: string[]) => Promise<void> | void;
}
