/**
 * Main-thread client for the in-browser agent worker.
 *
 * Each `AgentClient` instance is bound to a single `threadId` and owns
 * exactly one Web Worker (spawned lazily on first use). It wires the
 * worker up over Comlink and exposes a typed `ask()` method. The thread
 * id is injected into every request so the worker keys its in-memory
 * conversation memory by it. Lifecycle (create / terminate) is owned by
 * the `AgentThread` primitive — there is no global singleton.
 */
import * as Comlink from "comlink";

import type { RecentPipelineRun } from "@/agent/session";
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import type { AgentResponse, StatusCallback } from "@/agent/types";
import type { AgentWorkerApi } from "@/agent/worker";
import type { AiProviderConfig } from "@/types/aiProvider";

interface InitDeps {
  bridge: ToolBridgeApi;
  onStatus: StatusCallback;
}

interface AskOptions {
  message: string;
  recentRuns?: RecentPipelineRun[];
  aiConfig: AiProviderConfig;
}

export class AgentClient {
  private worker: Worker | null = null;
  private remote: Comlink.Remote<AgentWorkerApi> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly threadId: string) {}

  private async ensureInit(
    deps: InitDeps,
  ): Promise<Comlink.Remote<AgentWorkerApi>> {
    if (!this.worker) {
      this.worker = new Worker(new URL("@/agent/worker.ts", import.meta.url), {
        type: "module",
        name: "tangle-agent",
      });
      this.remote = Comlink.wrap<AgentWorkerApi>(this.worker);
    }
    if (!this.remote) {
      throw new Error("Worker remote was not created");
    }
    if (!this.initPromise) {
      // Pass `bridge` and `onStatus` as SEPARATE top-level Comlink-proxied
      // args. Comlink only applies its proxy transfer handler to top-level
      // argument values; it does not recursively walk into properties of
      // an object arg. Wrapping them in a single `{ bridge, onStatus }`
      // object would cause structured-clone of the methods and fail.
      this.initPromise = this.remote.init(
        Comlink.proxy(deps.bridge),
        Comlink.proxy(deps.onStatus),
      );
    }
    await this.initPromise;
    return this.remote;
  }

  async ask(
    deps: InitDeps,
    options: AskOptions,
    signal?: AbortSignal,
  ): Promise<AgentResponse> {
    const remote = await this.ensureInit(deps);
    const params = { ...options, threadId: this.threadId };
    return signal
      ? remote.ask(params, Comlink.proxy(signal))
      : remote.ask(params);
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.remote = null;
    this.initPromise = null;
  }
}
