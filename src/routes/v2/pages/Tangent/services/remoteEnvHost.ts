/**
 * Main-thread host for Tangent remote sub-agents.
 *
 * Wraps `connectRemoteEnvironment` from `@tangent/remote-subagent` and
 * bridges the orchestration protocol (spawn / message / kill) to the
 * in-browser agent worker, streaming the agent's lifecycle back as
 * `RemoteAgentEvent`s. Prime spawns an editor sub-agent here; the worker
 * runs it against the live MobX spec via the Comlink `ToolBridgeApi`, so
 * the user sees the canvas mutate in real time.
 *
 * Design notes:
 * - The socket lives here (not in the worker) so token refresh and
 *   reconnection are plain main-thread concerns; the worker only runs the
 *   agent loop.
 * - Turns are serialized per `agentId`: the protocol may deliver a second
 *   message before the first finishes, and a single agent has one spec/
 *   memory, so overlapping runs would corrupt its conversation.
 * - Status updates are attributed to the message's `runId` by echoing it
 *   on every emitted event.
 */
import {
  connectRemoteEnvironment,
  type RemoteEnvironmentClient,
  type RemoteEnvironmentHandlers,
  type RemoteKillCommand,
  type RemoteMessageCommand,
  type RemoteSpawnCommand,
  type RemoteToolMap,
} from "@tangent/remote-subagent";
import type { Remote } from "comlink";
import { proxy } from "comlink";

import type { RemoteEnvWorkerApi } from "@/agent/createRemoteEnvWorkerApi";
import { getTangentSocketConfig } from "@/routes/v2/pages/Tangent/services/socketConfig";
import { isRecord } from "@/utils/typeGuards";

const THINKING_STATUS_LABELS = new Set([
  "Thinking...",
  "Preparing response...",
]);

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "The remote editor agent failed.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

// Investigation instrumentation: without it a dropped socket, a call that never
// arrives, and a hung `execute` all look identical (see the workarea remote
// tools RCA). Filter DevTools on `[remote-env]`.
const REMOTE_ENV_TOOLS_CALL_EVENT = "remote:tools:call";

type RemoteEnvSocket = RemoteEnvironmentClient["socket"];

function logRemoteEnv(message: string, ...details: unknown[]): void {
  console.info(`[remote-env] ${message}`, ...details);
}

function envLabel(environmentId: string, socketId: string | undefined): string {
  return `${environmentId} (socket ${socketId ?? "?"})`;
}

function describeToolCall(request: unknown): { name: string; args: unknown } {
  if (!isRecord(request)) return { name: "<unknown>", args: undefined };
  const name = typeof request.name === "string" ? request.name : "<unknown>";
  return { name, args: request.arguments };
}

function wrapToolsWithLogging(
  tools: RemoteToolMap,
  environmentId: string,
  getSocketId: () => string | undefined,
): RemoteToolMap {
  const wrapped: RemoteToolMap = {};
  for (const [name, tool] of Object.entries(tools)) {
    wrapped[name] = {
      ...tool,
      execute: async (args) => {
        const startedAt = Date.now();
        const label = envLabel(environmentId, getSocketId());
        logRemoteEnv(`${label} tool start ${name}`, args);
        try {
          const result = await tool.execute(args);
          logRemoteEnv(`${label} tool ok ${name} ${Date.now() - startedAt}ms`);
          return result;
        } catch (error) {
          logRemoteEnv(
            `${label} tool error ${name} ${Date.now() - startedAt}ms`,
            errorMessage(error),
          );
          throw error;
        }
      },
    };
  }
  return wrapped;
}

function attachDiagnosticLogging(
  socket: RemoteEnvSocket,
  environmentId: string,
): void {
  socket.on("connect", () =>
    logRemoteEnv(`connected ${envLabel(environmentId, socket.id)}`),
  );
  socket.on("disconnect", (reason) =>
    logRemoteEnv(`disconnected ${envLabel(environmentId, socket.id)}`, reason),
  );
  socket.on("connect_error", (error: Error) =>
    logRemoteEnv(`connect_error ${environmentId}`, error.message),
  );
  // Do not ack here — the SDK's own listener owns the ack; this only observes.
  socket.on(REMOTE_ENV_TOOLS_CALL_EVENT, (request: unknown) => {
    const { name, args } = describeToolCall(request);
    logRemoteEnv(
      `call received ${envLabel(environmentId, socket.id)} ${name}`,
      args,
    );
  });
}

interface RemoteEnvHostBaseOptions {
  url: string;
  worker: Remote<RemoteEnvWorkerApi>;
  onError?: (message: string) => void;
}

interface RemoteEnvToolHostOptions {
  tools: RemoteToolMap;
  sessionId: string;
}

interface RemoteEnvAgentOnlyOptions {
  tools?: never;
  sessionId?: never;
}

export type RemoteEnvHostOptions = RemoteEnvHostBaseOptions &
  (RemoteEnvToolHostOptions | RemoteEnvAgentOnlyOptions);

export interface RemoteEnvHost {
  connect(token: string, environmentId: string): Promise<void>;
  disconnect(): void;
}

interface AgentLifecycle {
  chain: Promise<void>;
  cancelled: boolean;
  inFlight: boolean;
}

export function createRemoteEnvHost(
  options: RemoteEnvHostOptions,
): RemoteEnvHost {
  const { url, worker, onError, tools, sessionId } = options;

  let client: RemoteEnvironmentClient | null = null;
  const agentLifecycles = new Map<string, AgentLifecycle>();

  function isCurrent(agentId: string, lifecycle: AgentLifecycle): boolean {
    return !lifecycle.cancelled && agentLifecycles.get(agentId) === lifecycle;
  }

  function emitActivity(
    command: RemoteMessageCommand,
    lifecycle: AgentLifecycle,
    text: string,
  ): void {
    if (!isCurrent(command.agentId, lifecycle)) return;
    const kind = THINKING_STATUS_LABELS.has(text) ? "thinking" : "tool";
    client?.agentEvent(
      command.sessionId,
      command.agentId,
      { type: "activity", activity: { kind, label: text } },
      command.runId,
    );
  }

  function reportWorkerError(
    command: Pick<RemoteSpawnCommand, "sessionId" | "agentId">,
    error: unknown,
  ): void {
    const message = errorMessage(error);
    client?.agentEvent(command.sessionId, command.agentId, {
      type: "error",
      message,
    });
    client?.subagentUpdate(command.sessionId, command.agentId, "error");
    onError?.(message);
  }

  async function runTurn(
    command: RemoteMessageCommand,
    lifecycle: AgentLifecycle,
  ): Promise<void> {
    const { sessionId: turnSessionId, agentId, text, runId } = command;
    const messageId = generateMessageId();
    lifecycle.inFlight = true;

    client?.agentEvent(
      turnSessionId,
      agentId,
      { type: "start", messageId },
      runId,
    );

    try {
      const onStatus = proxy((status: { text: string }) =>
        emitActivity(command, lifecycle, status.text),
      );
      const { answer } = await worker.runTurn(
        { agentId, message: text },
        onStatus,
      );
      if (!isCurrent(agentId, lifecycle)) return;
      // The finalized `end` (with `content` + echoed `runId`) is the whole
      // turn: Tangent persists it as the sub-agent's Message and wakes Prime
      // via `atRunEnd`. Do NOT also `report()` the same text — that is the
      // `message_prime` path and would post a second copy Prime reacts to,
      // making the editor look like it repeated itself.
      client?.agentEvent(
        turnSessionId,
        agentId,
        { type: "end", messageId, content: answer, thinking: "" },
        runId,
      );
      client?.agentEvent(
        turnSessionId,
        agentId,
        { type: "activity", activity: null },
        runId,
      );
    } catch (error) {
      if (lifecycle.cancelled || isAbortError(error)) {
        if (agentLifecycles.get(agentId) !== lifecycle) return;
        client?.agentEvent(
          turnSessionId,
          agentId,
          { type: "activity", activity: null },
          runId,
        );
        return;
      }
      const message = errorMessage(error);
      client?.agentEvent(
        turnSessionId,
        agentId,
        { type: "error", messageId, message },
        runId,
      );
      client?.subagentUpdate(turnSessionId, agentId, "error");
      onError?.(message);
    } finally {
      lifecycle.inFlight = false;
    }
  }

  const handlers: Partial<RemoteEnvironmentHandlers> = {
    async onSpawn(command: RemoteSpawnCommand) {
      const previous = agentLifecycles.get(command.agentId);
      if (previous) previous.cancelled = true;

      const lifecycle: AgentLifecycle = {
        chain: Promise.resolve(),
        cancelled: false,
        inFlight: false,
      };
      agentLifecycles.set(command.agentId, lifecycle);

      lifecycle.chain = (async () => {
        try {
          if (previous) await worker.killAgent(command.agentId);
          if (!isCurrent(command.agentId, lifecycle)) return;
          await worker.spawnAgent({
            agentId: command.agentId,
            tools: command.tools,
            systemPrompt: command.systemPrompt,
            ...(command.model ? { model: command.model } : {}),
            ...(command.thinkingDepth
              ? { thinkingDepth: command.thinkingDepth }
              : {}),
          });
          if (!isCurrent(command.agentId, lifecycle)) {
            await worker.killAgent(command.agentId);
            return;
          }
          client?.subagentUpdate(command.sessionId, command.agentId, "active");
        } catch (error) {
          if (!isCurrent(command.agentId, lifecycle)) return;
          agentLifecycles.delete(command.agentId);
          reportWorkerError(command, error);
        }
      })();

      await lifecycle.chain;
    },

    onMessage(command: RemoteMessageCommand) {
      const lifecycle = agentLifecycles.get(command.agentId);
      if (!lifecycle) return Promise.resolve();
      const next = lifecycle.chain.then(() => {
        if (!isCurrent(command.agentId, lifecycle)) return;
        return runTurn(command, lifecycle);
      });
      lifecycle.chain = next.catch(() => undefined);
      return next;
    },

    async onKill(command: RemoteKillCommand) {
      const lifecycle = agentLifecycles.get(command.agentId);
      if (lifecycle) {
        lifecycle.cancelled = true;
        agentLifecycles.delete(command.agentId);
      }
      try {
        await worker.killAgent(command.agentId);
        client?.subagentUpdate(
          command.sessionId,
          command.agentId,
          command.completed ? "completed" : "killed",
        );
      } catch (error) {
        reportWorkerError(command, error);
      }
    },
  };

  return {
    connect(token, environmentId) {
      client?.disconnect();
      // Mirror TangentProvider: split a mounted-prefix baseUrl so the namespace
      // stays `/remote-env` and the transport path keeps the prefix (e.g.
      // `/tangent/socket.io`) instead of hitting the host root.
      const { socketUrl, socketPath } = getTangentSocketConfig(url);
      const socketHolder: { socket: RemoteEnvSocket | null } = { socket: null };
      const loggedTools = tools
        ? wrapToolsWithLogging(
            tools,
            environmentId,
            () => socketHolder.socket?.id,
          )
        : undefined;
      const nextClient = connectRemoteEnvironment({
        url: socketUrl,
        socketPath,
        token,
        environmentId,
        handlers,
        ...(loggedTools ? { tools: loggedTools, sessionId } : {}),
      });
      client = nextClient;
      socketHolder.socket = nextClient.socket;

      const connection = new Promise<void>((resolve, reject) => {
        let connected = nextClient.socket.connected;

        nextClient.socket.on("connect", () => {
          if (client !== nextClient) return;
          connected = true;
          resolve();
        });
        nextClient.socket.on("connect_error", (error: Error) => {
          if (client !== nextClient) return;
          if (!connected) {
            reject(
              new Error(
                `Tangent editor control failed to connect: ${error.message}`,
              ),
            );
            return;
          }
          onError?.(
            `Tangent editor control failed to reconnect: ${error.message}`,
          );
        });

        if (connected) resolve();
      });

      attachDiagnosticLogging(nextClient.socket, environmentId);

      return connection;
    },

    disconnect() {
      for (const [agentId, lifecycle] of agentLifecycles) {
        lifecycle.cancelled = true;
        if (lifecycle.inFlight) void worker.abortAgent(agentId);
      }
      agentLifecycles.clear();
      client?.disconnect();
      client = null;
    },
  };
}
