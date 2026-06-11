/**
 * Web Worker entry point for the Run View AI assistant.
 *
 * Spawns the read-only Run View dispatcher (general help + debug
 * assistant). The page owns the factory that creates this worker and
 * bakes the active run into `init()`; see `createRunViewAgentWorker`.
 */
// Must come first: installs the `globalThis.process` stub that
// `@openai/agents-core` needs before any SDK module is evaluated.
import "./processPolyfill";

import * as Comlink from "comlink";

import { createRunViewDispatcher } from "./agents/runViewDispatcher";
import { createWorkerApi } from "./createWorkerApi";

Comlink.expose(createWorkerApi(createRunViewDispatcher));
