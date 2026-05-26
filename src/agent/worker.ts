/**
 * Web Worker entry point for the in-browser agent.
 *
 * A placeholder `ask()` that echoes the user's message — it
 * proves the bundling, lazy-spawn, and Comlink round-trip are working
 * end-to-end before we wire the LLM and the tool bridge.
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

import type { AgentResponse } from "./types";

export interface AskParams {
  message: string;
  threadId?: string;
}

export interface AgentWorkerApi {
  ask(params: AskParams): Promise<AgentResponse>;
  ping(): Promise<"pong">;
}

let emitStatus: (status: { text: string }) => void = () => {};

function generateThreadId(): string {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const api: AgentWorkerApi = {
  async ping() {
    return "pong";
  },

  async ask({ message, threadId }) {
    /**
     * todo: replace with actual AI response.
     */
    return {
      answer: `Worker echo: ${message}`,
      threadId: threadId ?? generateThreadId(),
      componentReferences: {},
    };
  },
};

/**
 * Initialization entry point. Called once by the main thread immediately
 * after spawning the worker. Splits init from ask() so future bridge /
 * skill plumbing has an explicit lifecycle hook.
 */
export function init(onStatus: (status: { text: string }) => void): void {
  emitStatus = onStatus;
  // TODO: read `emitStatus` from the dispatcher's observability hooks;
  // until then this no-op read keeps `noUnusedLocals` quiet without
  // dropping the assignment that locks in the init() contract.
  void emitStatus;
}

Comlink.expose({ ...api, init });
