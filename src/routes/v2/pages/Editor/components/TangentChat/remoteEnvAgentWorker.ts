/**
 * Worker factory for the Tangent remote sub-agent host.
 *
 * We import the worker via `?worker&url` so Vite runs it through the worker
 * build pipeline (applying the `worker.plugins` shims), then hand the URL to
 * `createCrossOriginWorker` which tolerates CDN-hosted (cross-origin) scripts.
 */
import remoteEnvWorkerUrl from "@/agent/remoteEnvWorker.ts?worker&url";
import { createCrossOriginWorker } from "@/utils/createCrossOriginWorker";

export function createRemoteEnvAgentWorker(): Worker {
  return createCrossOriginWorker(remoteEnvWorkerUrl, {
    type: "module",
    name: "tangle-remote-env-agent",
  });
}
