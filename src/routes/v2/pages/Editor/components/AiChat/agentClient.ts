/**
 * Main-thread client for the in-browser agent worker.
 *
 * Spawns a single Web Worker (lazy, on first use), wires it up over
 * Comlink, and exposes a typed `ask()` method that the AI Chat store
 * calls.
 */
import * as Comlink from "comlink";

import type { AgentResponse } from "@/agent/types";
import type { AgentWorkerApi } from "@/agent/worker";

interface WorkerExports extends AgentWorkerApi {
  init(onStatus: (status: { text: string }) => void): void;
}

interface InitDeps {
  onStatus: (status: { text: string }) => void;
}

interface AskOptions {
  message: string;
  threadId?: string;
}

class AgentClient {
  private worker: Worker | null = null;
  private remote: Comlink.Remote<WorkerExports> | null = null;
  private initPromise: Promise<void> | null = null;

  private async ensureInit(
    deps: InitDeps,
  ): Promise<Comlink.Remote<WorkerExports>> {
    if (!this.worker) {
      this.worker = new Worker(new URL("@/agent/worker.ts", import.meta.url), {
        type: "module",
        name: "tangle-agent",
      });
      this.remote = Comlink.wrap<WorkerExports>(this.worker);
    }
    if (!this.remote) {
      throw new Error("Worker remote was not created");
    }
    if (!this.initPromise) {
      // Pass onStatus as a top-level Comlink-proxied arg.
      // Each new one must stay a separate top-level argument because Comlink only applies its proxy
      // transfer handler to top-level argument values, it does not
      // recursively walk into properties of an object arg.
      //
      // Wrapping proxied values in a single object would cause structured-clone
      // of the methods and fail.
      this.initPromise = this.remote.init(Comlink.proxy(deps.onStatus));
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
