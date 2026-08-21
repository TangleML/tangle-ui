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

export interface RemoteEnvHostOptions {
  /** Base Tangent URL; the `/remote-env` namespace is appended by the SDK. */
  url: string;
  /** The in-browser agent worker, already initialized with the bridge. */
  worker: Remote<RemoteEnvWorkerApi>;
  /** Surface a connection/runtime error to the user. */
  onError?: (message: string) => void;
  /**
   * RPC tools to register on the same environment (e.g. the workarea tools), so
   * one connection can both host sub-agents and answer tool calls. Requires
   * {@link RemoteEnvHostOptions.sessionId}.
   */
  tools?: RemoteToolMap;
  /** The session the {@link RemoteEnvHostOptions.tools} are registered for. */
  sessionId?: string;
}

export interface RemoteEnvHost {
  /** (Re)connect with a freshly minted token; disconnects any prior socket. */
  connect(token: string, environmentId: string): void;
  /** Close the socket without tearing down the worker. */
  disconnect(): void;
}

export function createRemoteEnvHost(
  options: RemoteEnvHostOptions,
): RemoteEnvHost {
  const { url, worker, onError, tools, sessionId } = options;

  let client: RemoteEnvironmentClient | null = null;
  const turnChains = new Map<string, Promise<void>>();
  // The AbortController lives in the worker (a proxied signal reads as always
  // aborted); the host only tracks which agents have a turn in flight so it can
  // ask the worker to abort them on disconnect.
  const inFlight = new Set<string>();

  function emitActivity(command: RemoteMessageCommand, text: string): void {
    const kind = THINKING_STATUS_LABELS.has(text) ? "thinking" : "tool";
    client?.agentEvent(
      command.sessionId,
      command.agentId,
      { type: "activity", activity: { kind, label: text } },
      command.runId,
    );
  }

  async function runTurn(command: RemoteMessageCommand): Promise<void> {
    const { sessionId, agentId, text, runId } = command;
    const messageId = generateMessageId();
    inFlight.add(agentId);

    client?.agentEvent(sessionId, agentId, { type: "start", messageId }, runId);

    try {
      const onStatus = proxy((status: { text: string }) =>
        emitActivity(command, status.text),
      );
      const { answer } = await worker.runTurn(
        { agentId, message: text },
        onStatus,
      );
      client?.agentEvent(
        sessionId,
        agentId,
        { type: "end", messageId, content: answer, thinking: "" },
        runId,
      );
      client?.agentEvent(
        sessionId,
        agentId,
        { type: "activity", activity: null },
        runId,
      );
      client?.report(sessionId, agentId, answer);
    } catch (error) {
      const message = errorMessage(error);
      client?.agentEvent(
        sessionId,
        agentId,
        { type: "error", messageId, message },
        runId,
      );
      client?.subagentUpdate(sessionId, agentId, "error");
      onError?.(message);
    } finally {
      inFlight.delete(agentId);
    }
  }

  const handlers: Partial<RemoteEnvironmentHandlers> = {
    async onSpawn(command: RemoteSpawnCommand) {
      await worker.spawnAgent({
        agentId: command.agentId,
        tools: command.tools,
        systemPrompt: command.systemPrompt,
        ...(command.model ? { model: command.model } : {}),
      });
      client?.subagentUpdate(command.sessionId, command.agentId, "active");
    },

    onMessage(command: RemoteMessageCommand) {
      const previous = turnChains.get(command.agentId) ?? Promise.resolve();
      const next = previous.then(() => runTurn(command));
      // Swallow rejection on the chain so one failed turn doesn't wedge the
      // queue; `runTurn` already reports errors to the session and the host.
      turnChains.set(
        command.agentId,
        next.catch(() => undefined),
      );
      return next;
    },

    async onKill(command: RemoteKillCommand) {
      // `killAgent` aborts the in-flight turn in the worker before removing it.
      await worker.killAgent(command.agentId);
      turnChains.delete(command.agentId);
      client?.subagentUpdate(
        command.sessionId,
        command.agentId,
        command.completed ? "completed" : "killed",
      );
    },
  };

  return {
    connect(token, environmentId) {
      client?.disconnect();
      client = connectRemoteEnvironment({
        url,
        token,
        environmentId,
        handlers,
        ...(tools ? { tools, sessionId } : {}),
      });
      client.socket.on("connect_error", (error: Error) => {
        onError?.(`Tangent editor control failed to connect: ${error.message}`);
      });
    },

    disconnect() {
      for (const agentId of inFlight) void worker.abortAgent(agentId);
      inFlight.clear();
      turnChains.clear();
      client?.disconnect();
      client = null;
    },
  };
}
