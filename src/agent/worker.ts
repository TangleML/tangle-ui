/**
 * Web Worker entry point for the in-browser agent.
 *
 * A placeholder `ask()` that echoes the user's message — it
 * proves the bundling, lazy-spawn, and Comlink round-trip are working
 * end-to-end before we wire the LLM and the tool bridge.
 */
// Must come first: installs the `globalThis.process` stub that
// `@openai/agents-core` needs before any SDK module is evaluated.
import "./processPolyfill";

import * as Comlink from "comlink";

import type { AgentResponse } from "./types";

export interface AskParams {
  message: string;
  threadId?: string;
}

export interface AgentWorkerApi {
  ask(params: AskParams, signal?: AbortSignal): Promise<AgentResponse>;
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

  async ask({ message, threadId }, _signal) {
    // todo: add logic to handle the signal

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
