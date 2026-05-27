/**
 * Web Worker entry point for the in-browser agent.
 *
 * Main-thread `AgentClient` spawns this worker once (lazily) and
 * `init(onStatus)` is called immediately after spawn.
 *
 * Worker-only resolution of `@openai/agents-core/_shims` to its
 * browser variant is handled by the `worker.plugins` block in
 * `vite.config.js`. The runtime side of "no Node in the worker" — the
 * unguarded `process.env.X` read in `@openai/agents-core` v0.4.x —
 * is handled by the `globalThis.process` stub below.
 *
 * The stub covers `runner/sessionPersistence.mjs` reading
 * `process.env.OPENAI_AGENTS__DEBUG_SAVE_SESSION` without a
 * `typeof process` guard, which would otherwise throw
 * `ReferenceError: process is not defined` on every turn that
 * persists session state. The stub deliberately omits `.on` /
 * `.exit` so the SDK's `typeof process.on === 'function'` checks
 * still skip the Node-only branches and we do not pretend to be
 * Node. It is inlined here (rather than living in a separate
 * polyfill file) so Rolldown's worker bundle does not tree-shake
 * the side-effect import, and so it runs in both `vite build` and
 * `vite serve` (dev) modes, which `worker.rolldownOptions.define`
 * would not.
 */
const __workerGlobal = globalThis as { process?: { env?: unknown } };
if (typeof __workerGlobal.process === "undefined") {
  __workerGlobal.process = { env: {} };
}
// Anchor: keep Rolldown from tree-shaking the assignment above. In
// `vite build` Vite statically replaces `process.env` with `{}`, so the
// rest of the bundle never reads `globalThis.process` and Rolldown
// would otherwise treat the write as dead. Throwing on a hasOwnProperty
// check forces the write to be observable.
if (!Object.prototype.hasOwnProperty.call(globalThis, "process")) {
  throw new Error("Tangle agent worker: globalThis.process polyfill failed");
}

import * as Comlink from "comlink";

import type { ComponentRefData } from "@/routes/v2/pages/Editor/components/AiChat/aiChat.types";

import {
  createDispatcher,
  type TangleDispatcher,
} from "./agents/tangleDispatcher";
import { getAiToken } from "./aiTokenStore";
import { ProxyClient } from "./config";
import { createSession } from "./session";
import type { AgentResponse, StatusCallback } from "./types";

export interface AskParams {
  message: string;
  threadId?: string;
}

export interface AgentWorkerApi {
  init(onStatus: StatusCallback): void;
  ping(): Promise<"pong">;
  ask(params: AskParams): Promise<AgentResponse>;
}

function generateThreadId(): string {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createWorkerApi(): AgentWorkerApi {
  let dispatcher: TangleDispatcher | null = null;
  let emitStatus: StatusCallback = () => {};
  const proxyClient = new ProxyClient();

  return {
    /**
     * Initialization entry point. Called once by the main thread
     * immediately after spawning the worker. Splits init from ask() so
     * the tool bridge plumbing and skill warm-up have an explicit
     * lifecycle hook later.
     */
    init(onStatus) {
      if (dispatcher) return;
      emitStatus = onStatus;
      dispatcher = createDispatcher();
    },

    async ping() {
      return "pong";
    },

    async ask({ message, threadId }) {
      if (!dispatcher) {
        throw new Error(
          "Agent worker not initialized. Call init() before ask().",
        );
      }
      const token = await getAiToken();
      if (!token) {
        throw new Error(
          "AI assistant token is missing. Open the AI panel to set it.",
        );
      }
      const resolvedThreadId = threadId ?? generateThreadId();
      const session = createSession({
        threadId: resolvedThreadId,
        emitStatus,
        proxyClient,
      });

      const result = await dispatcher.invoke({
        message,
        threadId: resolvedThreadId,
        token,
        session,
      });

      // TODO: replace this empty map with `session.componentReferences`
      // populated by the search_components tool.
      const componentReferences: AgentResponse["componentReferences"] = {};
      const refs = new Map<string, ComponentRefData>();
      for (const [id, ref] of refs) {
        if (result.answer.includes(`component://${id}`)) {
          componentReferences[id] = {
            name: ref.name,
            yamlText: ref.yamlText,
          };
        }
      }

      return {
        answer: result.answer,
        threadId: result.threadId,
        componentReferences,
      };
    },
  };
}

Comlink.expose(createWorkerApi());
