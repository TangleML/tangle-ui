/**
 * Main-thread client for the in-browser agent worker.
 *
 * Spawns a single Web Worker (lazy, on first use), wires it up over
 * Comlink, and exposes a typed `ask()` method that the AI Chat store
 * calls.
 */
import * as Comlink from "comlink";

import type { RecentPipelineRun } from "@/agent/session";
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import type { AgentResponse, StatusCallback } from "@/agent/types";
import type { AgentWorkerApi } from "@/agent/worker";

interface InitDeps {
  bridge: ToolBridgeApi;
  onStatus: StatusCallback;
}

interface AskOptions {
  message: string;
  threadId?: string;
  recentRuns?: RecentPipelineRun[];
}

class AgentClient {
  private worker: Worker | null = null;
  private remote: Comlink.Remote<AgentWorkerApi> | null = null;
  private initPromise: Promise<void> | null = null;

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
    return signal
      ? remote.ask(options, Comlink.proxy(signal))
      : remote.ask(options);
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.remote = null;
    this.initPromise = null;
  }
}

let singleton: AgentClient | null = null;

export function getAgentClient(): AgentClient {
  if (!singleton) singleton = new AgentClient();
  return singleton;
}
