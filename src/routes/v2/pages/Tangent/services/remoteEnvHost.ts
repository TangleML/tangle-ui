/**
 * Main-thread host that registers a workarea tool catalog on a Tangent
 * `/remote-env` connection.
 *
 * The environment offers RPC **tools** (open / list / read / close workarea
 * tabs) so an agent can arrange the Dynamic Workarea. It hosts no sub-agent
 * runtime yet: the spawn / message / kill handlers (and the in-browser agent
 * worker that runs them) arrive with the remote agent in a later change.
 *
 * The socket lives here (not in a worker) so token refresh and reconnection
 * stay plain main-thread concerns.
 */
import {
  connectRemoteEnvironment,
  type RemoteEnvironmentClient,
  type RemoteToolMap,
} from "@tangent/remote-subagent";

import { getTangentSocketConfig } from "@/routes/v2/pages/Tangent/services/socketConfig";

export interface RemoteEnvHostOptions {
  url: string;
  tools: RemoteToolMap;
  sessionId: string;
  onError?: (message: string) => void;
}

export interface RemoteEnvHost {
  connect(token: string, environmentId: string): void;
  disconnect(): void;
}

export function createRemoteEnvHost(
  options: RemoteEnvHostOptions,
): RemoteEnvHost {
  const { url, tools, sessionId, onError } = options;

  let client: RemoteEnvironmentClient | null = null;

  return {
    connect(token, environmentId) {
      client?.disconnect();
      // Mirror TangentProvider: split a mounted-prefix baseUrl so the namespace
      // stays `/remote-env` and the transport path keeps the prefix (e.g.
      // `/tangent/socket.io`) instead of hitting the host root.
      const { socketUrl, socketPath } = getTangentSocketConfig(url);
      client = connectRemoteEnvironment({
        url: socketUrl,
        socketPath,
        token,
        environmentId,
        tools,
        sessionId,
      });
      client.socket.on("connect_error", (error: Error) => {
        onError?.(
          `Tangent workarea control failed to connect: ${error.message}`,
        );
      });
    },

    disconnect() {
      client?.disconnect();
      client = null;
    },
  };
}
