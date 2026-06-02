/**
 * Side-effect polyfill for `globalThis.process`.
 *
 * `@openai/agents-core` v0.4.x reads `process.env.OPENAI_AGENTS__DEBUG_SAVE_SESSION`
 * without a `typeof process` guard, which throws `ReferenceError: process is not
 * defined` inside a Worker realm. This stub deliberately omits `.on` / `.exit` so
 * the SDK's `typeof process.on === "function"` checks still skip the Node-only
 * branches — we provide just enough to satisfy the unguarded `process.env` read
 * without pretending to be Node.
 *
 * Lives in its own module so it can be imported as a side-effect (which is never
 * tree-shaken) before any other import in the worker entry point.
 */
const g = globalThis as { process?: { env?: unknown } };
if (typeof g.process === "undefined") {
  g.process = { env: {} };
}
