import type { SlashCommand } from "./types.ts";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const help: SlashCommand = {
  name: "help",
  description: "List the available commands.",
  run: (ctx) => {
    ctx.print("Commands:");
    for (const command of COMMANDS) {
      ctx.print(`  /${command.name} — ${command.description}`);
    }
  },
};

const resources: SlashCommand = {
  name: "resources",
  description: "List the project's catalogued resources.",
  run: async (ctx) => {
    try {
      const items = await ctx.tangle.listResources(ctx.project.id);
      if (items.length === 0) {
        ctx.print("No resources in this project.");
        return;
      }
      ctx.print(`Resources (${items.length}):`);
      for (const item of items) {
        ctx.print(`  [${item.entity}] ${item.name ?? item.id}`);
      }
    } catch (err) {
      ctx.print(`Failed to list resources: ${errorMessage(err)}`);
    }
  },
};

const agents: SlashCommand = {
  name: "agents",
  description: "List the sub-agents in this session, plus local hosts.",
  run: (ctx) => {
    if (ctx.subagents.length === 0) {
      ctx.print("No sub-agents in this session yet.");
    } else {
      ctx.print(`Sub-agents (${ctx.subagents.length}):`);
      for (const subagent of ctx.subagents) {
        ctx.print(`  ${subagent.name} — ${subagent.status}`);
      }
    }
    const { bridge } = ctx.host;
    const hosted = bridge.listAgents();
    ctx.print(
      `Local host: ${bridge.state}, ${hosted.length} local sub-agent(s).`,
    );
    if (bridge.lastError) ctx.print(`  Last error: ${bridge.lastError}`);
    ctx.print(
      `Signed in as: ${ctx.userEmail ?? "unknown (Prime may not see the local host)"}`,
    );
  },
};

const sessions: SlashCommand = {
  name: "sessions",
  description: "List this project's sessions.",
  run: async (ctx) => {
    try {
      const items = await ctx.shell.listSessionsByProject(ctx.project.id);
      if (items.length === 0) {
        ctx.print("No sessions in this project.");
        return;
      }
      ctx.print(`Sessions (${items.length}):`);
      for (const item of items) {
        const current = item.id === ctx.sessionId ? " (current)" : "";
        ctx.print(`  ${item.name}${current}`);
      }
    } catch (err) {
      ctx.print(`Failed to list sessions: ${errorMessage(err)}`);
    }
  },
};

const newSession: SlashCommand = {
  name: "new",
  description: "Start or switch to another session.",
  run: (ctx) => {
    ctx.goToSessions();
  },
};

const web: SlashCommand = {
  name: "web",
  description: "Open this project and session in the browser.",
  run: async (ctx) => {
    const path = `/tangent/${encodeURIComponent(ctx.project.id)}?session=${encodeURIComponent(ctx.sessionId)}`;
    try {
      await ctx.openWeb(path);
      ctx.print(`Opened ${ctx.config.uiUrl}${path}`);
    } catch (err) {
      ctx.print(`Could not open the browser: ${errorMessage(err)}`);
    }
  },
};

const reset: SlashCommand = {
  name: "reset",
  description: "Forget the saved instance and sign-in, then reconnect.",
  run: async (ctx) => {
    await ctx.reset();
  },
};

/** The built-in command set. Append a {@link SlashCommand} to extend it. */
export const COMMANDS: SlashCommand[] = [
  help,
  resources,
  agents,
  sessions,
  newSession,
  web,
  reset,
];

export function findCommand(name: string): SlashCommand | undefined {
  return COMMANDS.find((command) => command.name === name);
}

export interface ParsedCommand {
  name: string;
  args: string[];
}

/** Parses `/name arg1 arg2` into its command name and arguments, else `null`. */
export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  const [name, ...args] = trimmed.slice(1).split(/\s+/);
  if (!name) return null;
  return { name, args };
}
