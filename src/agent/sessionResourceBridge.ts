/**
 * Main-thread access to the Tangent session's resource catalog, handed to the
 * worker as a Comlink proxy per turn. The socket client that backs it lives in
 * `remoteEnvHost.ts`; the worker's sub-agent reaches it only through this
 * narrow surface, scoped to the turn's session.
 */
import type { RemoteResourceInput } from "@tangent/remote-subagent";
import type { Resource } from "@tangent/shared/contracts.ts";

export interface SessionResourceBridge {
  list(): Promise<Resource[]>;
  read(uri: string): Promise<{ content: string; contentType: string }>;
  put(input: RemoteResourceInput): Promise<Resource>;
}
