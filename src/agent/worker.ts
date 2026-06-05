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

import type { AiProviderConfig } from "@/types/aiProvider";

import {
  createDispatcher,
  type TangleDispatcher,
} from "./agents/tangleDispatcher";
import { ProxyClient } from "./config";
import { createSession, type RecentPipelineRun } from "./session";
import { SkillsLoader } from "./skills/loader";
import type { ToolBridgeApi } from "./toolBridgeApi";
import type { AgentResponse, StatusCallback } from "./types";

export interface AskParams {
  message: string;
  threadId?: string;
  recentRuns?: RecentPipelineRun[];
  aiConfig: AiProviderConfig;
}

export interface AgentWorkerApi {
  init(bridge: ToolBridgeApi, onStatus: StatusCallback): void;
  ping(): Promise<"pong">;
  ask(params: AskParams, signal?: AbortSignal): Promise<AgentResponse>;
}

function generateThreadId(): string {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createWorkerApi(): AgentWorkerApi {
  let dispatcher: TangleDispatcher | null = null;
  let bridge: ToolBridgeApi | null = null;
  let emitStatus: StatusCallback = () => {};
  const proxyClient = new ProxyClient();
  const skillsLoader = new SkillsLoader();

  return {
    /**
     * Initialization entry point. Called once by the main thread
     * immediately after spawning the worker.
     */
    init(toolBridge, onStatus) {
      // Dispose any prior dispatcher (detaches its observability listeners)
      // so a fresh onStatus fully replaces the old one on re-init.
      dispatcher?.dispose();
      bridge = toolBridge;
      emitStatus = onStatus;
      dispatcher = createDispatcher();
    },

    async ping() {
      return "pong";
    },

    async ask({ message, threadId, recentRuns, aiConfig }, _signal) {
      // todo: add logic to handle the signal

      if (!dispatcher || !bridge) {
        throw new Error(
          "Agent worker not initialized. Call init() before ask().",
        );
      }
      const resolvedThreadId = threadId ?? generateThreadId();
      const session = createSession({
        threadId: resolvedThreadId,
        emitStatus,
        proxyClient,
        bridge,
        skillsLoader,
        aiConfig,
        recentRuns,
      });

      const result = await dispatcher.invoke({
        message,
        threadId: resolvedThreadId,
        aiConfig,
        session,
      });

      // TODO: populate from session.componentReferences once the
      // search_components tool is wired (PR 4+).
      const componentReferences: AgentResponse["componentReferences"] = {};

      return {
        answer: result.answer,
        threadId: result.threadId,
        componentReferences,
      };
    },
  };
}

Comlink.expose(createWorkerApi());
