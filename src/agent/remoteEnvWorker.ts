/**
 * Web Worker entry point for the Tangent remote sub-agent host.
 *
 * Hosts remote editor sub-agents spawned by Prime over the remote-subagent
 * protocol. The main thread owns the socket transport and token lifecycle
 * (`remoteEnvHost.ts`); this worker only runs the agent loop and the CSOM
 * tool surface bound to the live spec.
 */
// Must come first: installs the `globalThis.process` stub that
// `@openai/agents-core` needs before any SDK module is evaluated.
import "./processPolyfill";

import * as Comlink from "comlink";

import { createRemoteEnvWorkerApi } from "./createRemoteEnvWorkerApi";

Comlink.expose(createRemoteEnvWorkerApi());
