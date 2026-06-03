/**
 * Worker factory for the Editor AI assistant.
 *
 * The Editor window owns spawning its agent worker. We import the worker
 * via `?worker&url` so Vite still runs it through the worker build pipeline
 * (applying the `worker.plugins` shims), then hand the URL to
 * `createCrossOriginWorker` which tolerates CDN-hosted (cross-origin) scripts.
 */
import editorWorkerUrl from "@/agent/editorWorker.ts?worker&url";
import { createCrossOriginWorker } from "@/utils/createCrossOriginWorker";

export function createEditorAgentWorker(): Worker {
  return createCrossOriginWorker(editorWorkerUrl, {
    type: "module",
    name: "tangle-editor-agent",
  });
}
