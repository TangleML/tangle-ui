/**
 * Worker factory for the Editor AI assistant.
 *
 * The Editor window owns spawning its agent worker so the URL literal
 * stays statically analyzable for Vite's worker bundling.
 */
export function createEditorAgentWorker(): Worker {
  return new Worker(new URL("@/agent/editorWorker.ts", import.meta.url), {
    type: "module",
    name: "tangle-editor-agent",
  });
}
