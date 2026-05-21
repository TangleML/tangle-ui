/**
 * Web Worker entry point for the in-browser agent.
 *
 * The main thread spawns this worker, hands it a Comlink-proxied
 * `ToolBridgeApi` (which mutates the live MobX spec) and a status
 * callback, then calls `ask()` for each user turn. All LLM traffic
 * stays inside this worker so heavy JSON parsing never blocks the UI.
 *
 * Worker-only resolution of `@openai/agents-core/_shims` to its
 * browser variant is handled by the `worker.plugins` block in
 * `vite.config.js`.
 *
 * The `globalThis.process` stub below covers an unguarded
 * `process.env.X` read in `@openai/agents-core` v0.4.x
 * (`runner/sessionPersistence.mjs` reads
 * `process.env.OPENAI_AGENTS__DEBUG_SAVE_SESSION` without a
 * `typeof process` guard) that would otherwise throw
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

import { invokeDispatcher } from "./agents/tangleDispatcher";
import { createSession, type RecentPipelineRun } from "./session";
import { loadSkill } from "./skills/loader";
import type { ToolBridgeApi } from "./toolBridgeApi";
import type { AgentResponse } from "./types";

export interface AskParams {
  message: string;
  threadId?: string;
  selectedEntityId?: string;
  recentRuns?: RecentPipelineRun[];
}

export interface AgentWorkerApi {
  ask(params: AskParams): Promise<AgentResponse>;
  ping(): Promise<"pong">;
}

let bridge: ToolBridgeApi | null = null;
let emitStatus: (status: { text: string }) => void = () => {};

function generateThreadId(): string {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const api: AgentWorkerApi = {
  async ping() {
    return "pong";
  },

  async ask({ message, threadId, selectedEntityId, recentRuns }) {
    if (!bridge) {
      throw new Error(
        "Tool bridge has not been initialized — call init() before ask().",
      );
    }

    const resolvedThreadId = threadId ?? generateThreadId();
    const session = createSession({
      threadId: resolvedThreadId,
      bridge,
      emitStatus,
      recentRuns,
    });

    const result = await invokeDispatcher({
      message,
      threadId: resolvedThreadId,
      selectedEntityId,
      session,
    });

    const componentReferences: AgentResponse["componentReferences"] = {};
    for (const [id, ref] of session.componentReferences) {
      if (result.answer.includes(`component://${id}`)) {
        componentReferences[id] = { name: ref.name, yamlText: ref.yamlText };
      }
    }

    return {
      answer: result.answer,
      threadId: result.threadId,
      componentReferences,
    };
  },
};

/**
 * Initialization entry point. Called once by the main thread immediately
 * after spawning the worker. Splits init from ask() so the bridge proxy
 * lifecycle is explicit. Skill caches are warmed eagerly so the first
 * agent turn does not pay the network cost.
 *
 * The bridge and onStatus arguments must be passed as separate top-level
 * arguments so each can be marked with `Comlink.proxy()` and transferred
 * via MessagePort. Comlink does NOT recursively walk object arguments
 * looking for proxy markers — wrapping them in `{ bridge, onStatus }`
 * here would cause structured-clone of the bridge methods and fail.
 */
export function init(
  toolBridge: ToolBridgeApi,
  onStatus: (status: { text: string }) => void,
): void {
  bridge = toolBridge;
  emitStatus = onStatus;
  void loadSkill("tangleBestPractices").catch(() => {});
  void loadSkill("componentYamlFormat").catch(() => {});
}

Comlink.expose({ ...api, init });
