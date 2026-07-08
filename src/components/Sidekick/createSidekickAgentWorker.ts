/**
 * Worker factory for the global Sidekick assistant.
 *
 * Kept beside the component so Vite can statically analyze the worker URL.
 */
export function createSidekickAgentWorker(): Worker {
  return new Worker(new URL("@/agent/generalWorker.ts", import.meta.url), {
    type: "module",
    name: "tangle-sidekick-agent",
  });
}
