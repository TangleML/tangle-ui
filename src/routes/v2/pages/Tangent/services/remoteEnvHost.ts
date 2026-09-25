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
import type { AgentTargetRouter } from "@/routes/v2/pages/Tangent/services/createActiveTabRoutingBridge";
import { getTangentSocketConfig } from "@/routes/v2/pages/Tangent/services/socketConfig";

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

interface RemoteEnvHostBaseOptions {
  url: string;
  worker: Remote<RemoteEnvWorkerApi>;
  onError?: (message: string) => void;
  agentTargets?: AgentTargetRouter;
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
  const { url, worker, onError, tools, sessionId, agentTargets } = options;

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
      agentTargets?.pinTurn(agentId);
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
            ...(agentTargets
              ? { bridge: proxy(agentTargets.bridgeFor(command.agentId)) }
              : {}),
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
      agentTargets?.forget(command.agentId);
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
      const nextClient = connectRemoteEnvironment({
        url: socketUrl,
        socketPath,
        token,
        environmentId,
        handlers,
        ...(tools ? { tools, sessionId } : {}),
      });
      client = nextClient;

      return new Promise<void>((resolve, reject) => {
        let connected = nextClient.socket.connected;

        // Settle rather than return when a newer connection (or a disconnect)
        // has taken over: the caller awaits this before scheduling the next
        // token refresh, so a pending promise would stop that loop for good.
        // Being superseded is not a failure, so resolve rather than reject.
        nextClient.socket.on("connect", () => {
          if (client !== nextClient) {
            resolve();
            return;
          }
          connected = true;
          resolve();
        });
        nextClient.socket.on("connect_error", (error: Error) => {
          if (client !== nextClient) {
            resolve();
            return;
          }
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
