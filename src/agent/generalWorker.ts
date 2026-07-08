/**
 * Web Worker entry point for the global Sidekick assistant.
 *
 * Spawns the general Tangle dispatcher used outside editor-specific pages.
 */
// Must come first: installs the `globalThis.process` stub that
// `@openai/agents-core` needs before any SDK module is evaluated.
import "./processPolyfill";

import * as Comlink from "comlink";

import { createGeneralDispatcher } from "./agents/generalDispatcher";
import { createWorkerApi } from "./createWorkerApi";

Comlink.expose(createWorkerApi(createGeneralDispatcher));
