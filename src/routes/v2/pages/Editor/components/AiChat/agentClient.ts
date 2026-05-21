/**
 * Main-thread client for the in-browser agent worker.
 *
 * Spawns a single Web Worker (lazy, on first use), wires it up with a
 * Comlink-proxied tool bridge that talks to the live MobX editor state,
 * and exposes a typed `ask()` method that the AI Chat store calls.
 */
import * as Comlink from "comlink";

import type { RecentPipelineRun } from "@/agent/session";
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import type { AgentResponse } from "@/agent/types";
import type { AgentWorkerApi } from "@/agent/worker";
import type { ComponentSpec } from "@/models/componentSpec";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";

import { createToolBridge } from "./toolBridge";

interface WorkerExports extends AgentWorkerApi {
  init(
    bridge: ToolBridgeApi,
    onStatus: (status: { text: string }) => void,
  ): void;
}

interface InitDeps {
  getSpec: () => ComponentSpec | null;
  undo: UndoGroupable;
  onStatus: (status: { text: string }) => void;
}

interface AskOptions {
  message: string;
  threadId?: string;
  selectedEntityId?: string;
  recentRuns?: RecentPipelineRun[];
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
      const bridge = createToolBridge({
        getSpec: deps.getSpec,
        undo: deps.undo,
      });
      // Pass bridge and onStatus as separate top-level args: Comlink only
      // applies its proxy transfer handler to top-level argument values,
      // it does not recursively walk into properties of an object arg.
      this.initPromise = this.remote.init(
        Comlink.proxy(bridge),
        Comlink.proxy(deps.onStatus),
      );
    }
    await this.initPromise;
    return this.remote;
  }

  async ask(deps: InitDeps, options: AskOptions): Promise<AgentResponse> {
    const remote = await this.ensureInit(deps);
    return remote.ask(options);
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
