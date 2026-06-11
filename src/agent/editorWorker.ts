/**
 * Web Worker entry point for the Editor AI assistant.
 *
 * Spawns the full Editor dispatcher (general help, pipeline repair,
 * pipeline architect, debug assistant). The page owns the factory that
 * creates this worker; see `createEditorAgentWorker`.
 */
// Must come first: installs the `globalThis.process` stub that
// `@openai/agents-core` needs before any SDK module is evaluated.
import "./processPolyfill";

import * as Comlink from "comlink";

import { createEditorDispatcher } from "./agents/editorDispatcher";
import { createWorkerApi } from "./createWorkerApi";

Comlink.expose(createWorkerApi(createEditorDispatcher));
