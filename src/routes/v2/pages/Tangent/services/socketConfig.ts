import { io, type Socket } from "socket.io-client";

export interface TangentSocketConfig {
  socketUrl: string;
  socketPath: string;
}

/**
 * Socket.IO treats the URL as an origin and derives the endpoint from a
 * separate path, so a mounted-prefix baseUrl must be split: the prefix moves
 * into socketPath, otherwise the connection drops it and hits the host root.
 */
export function getTangentSocketConfig(baseUrl: string): TangentSocketConfig {
  const url = new URL(baseUrl);
  const prefix = url.pathname.replace(/\/+$/, "");
  return {
    socketUrl: url.origin,
    socketPath: `${prefix}/socket.io`,
  };
}

/** A socket to a Tangent server, as this person when there's a token. */
export function connectTangentSocket(
  baseUrl: string,
  authToken: string | undefined,
): Socket {
  const { socketUrl, socketPath } = getTangentSocketConfig(baseUrl);
  return io(socketUrl, {
    path: socketPath,
    auth: authToken ? { token: authToken } : {},
  });
}
