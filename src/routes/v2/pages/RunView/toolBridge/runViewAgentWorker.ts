/**
 * Worker factory for the Run View AI assistant.
 *
 * The Run View window owns spawning its agent worker so the URL literal
 * stays statically analyzable for Vite's worker bundling.
 */
export function createRunViewAgentWorker(): Worker {
  return new Worker(new URL("@/agent/runViewWorker.ts", import.meta.url), {
    type: "module",
    name: "tangle-run-view-agent",
  });
}
