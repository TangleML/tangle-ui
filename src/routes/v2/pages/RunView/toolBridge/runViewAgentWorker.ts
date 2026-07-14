/**
 * Worker factory for the Run View AI assistant.
 *
 * The Run View window owns spawning its agent worker. We import the worker
 * via `?worker&url` so Vite still runs it through the worker build pipeline
 * (applying the `worker.plugins` shims), then hand the URL to
 * `createCrossOriginWorker` which tolerates CDN-hosted (cross-origin) scripts.
 */
import runViewWorkerUrl from "@/agent/runViewWorker.ts?worker&url";
import { createCrossOriginWorker } from "@/utils/createCrossOriginWorker";

export function createRunViewAgentWorker(): Worker {
  return createCrossOriginWorker(runViewWorkerUrl, {
    type: "module",
    name: "tangle-run-view-agent",
  });
}
