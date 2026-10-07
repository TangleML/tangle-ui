import { randomUUID } from "node:crypto";

import { type RawData, type WebSocket, WebSocketServer } from "ws";

import {
  type BroadcastMessage,
  COLLAB_MODEL_VERSION,
  COLLAB_PROTOCOL_VERSION,
  type HelloMessage,
  isCommandMessage,
  isJoinMessage,
  isSnapshotMessage,
  type LogEntry,
  type ServerMessage,
  type SnapshotRequestMessage,
} from "../src/services/collaboration/protocol";
import { InMemoryRoomStore, type RoomStore } from "./roomStore";

export interface CollabServerOptions {
  port: number;
  logFoldAt: number;
  store?: RoomStore;
}

export interface CollabServer {
  readonly port: number;
  close(): Promise<void>;
}

interface Connection {
  actorId: string;
  roomId: string | null;
  socket: WebSocket;
}

export function createCollabServer(
  options: CollabServerOptions,
): Promise<CollabServer> {
  const store = options.store ?? new InMemoryRoomStore();
  const connections = new Set<Connection>();
  const pendingFolds = new Map<string, string>();

  function send(socket: WebSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }

  function reject(socket: WebSocket, seq: number | null, reason: string): void {
    send(socket, { type: "reject", seq, reason });
  }

  function broadcastToRoom(roomId: string, message: BroadcastMessage): void {
    for (const connection of connections) {
      if (connection.roomId === roomId) send(connection.socket, message);
    }
  }

  function maybeFold(roomId: string): void {
    const room = store.get(roomId);
    if (!room) return;
    if (pendingFolds.has(roomId)) return;
    if (room.log.length <= options.logFoldAt) return;

    const willing = [...connections].find(
      (connection) => connection.roomId === roomId,
    );
    if (!willing) return;

    pendingFolds.set(roomId, willing.actorId);
    const request: SnapshotRequestMessage = {
      type: "snapshotRequest",
      version: room.version,
    };
    send(willing.socket, request);
  }

  function handleMessage(connection: Connection, data: RawData): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      reject(connection.socket, null, "invalid JSON");
      return;
    }

    if (isJoinMessage(parsed)) {
      if (
        parsed.protocolVersion !== COLLAB_PROTOCOL_VERSION ||
        parsed.modelVersion !== COLLAB_MODEL_VERSION
      ) {
        reject(
          connection.socket,
          null,
          `version mismatch: server speaks protocol ${COLLAB_PROTOCOL_VERSION} / model ${COLLAB_MODEL_VERSION}`,
        );
        connection.socket.close();
        return;
      }
      const room =
        store.get(parsed.room) ?? store.create(parsed.room, parsed.snapshot);
      connection.roomId = parsed.room;
      const hello: HelloMessage = {
        type: "hello",
        protocolVersion: COLLAB_PROTOCOL_VERSION,
        modelVersion: COLLAB_MODEL_VERSION,
        actorId: connection.actorId,
        version: room.version,
        snapshot: room.snapshot,
        log: room.log,
      };
      send(connection.socket, hello);
      return;
    }

    if (isCommandMessage(parsed)) {
      const roomId = connection.roomId;
      if (!roomId) {
        reject(connection.socket, parsed.seq, "command before join");
        return;
      }
      const room = store.get(roomId);
      if (!room) {
        reject(connection.socket, parsed.seq, "unknown room");
        return;
      }
      room.version += 1;
      const entry: LogEntry = {
        version: room.version,
        actorId: connection.actorId,
        seq: parsed.seq,
        command: parsed.command,
      };
      room.log.push(entry);
      broadcastToRoom(roomId, {
        type: "broadcast",
        version: entry.version,
        actorId: entry.actorId,
        seq: entry.seq,
        command: entry.command,
      });
      maybeFold(roomId);
      return;
    }

    if (isSnapshotMessage(parsed)) {
      const roomId = connection.roomId;
      if (!roomId) return;
      const room = store.get(roomId);
      if (!room) return;
      if (!pendingFolds.has(roomId)) return;
      pendingFolds.delete(roomId);
      if (
        parsed.version < room.snapshotVersion ||
        parsed.version > room.version
      ) {
        return;
      }
      room.snapshot = parsed.snapshot;
      room.snapshotVersion = parsed.version;
      room.log = room.log.filter((entry) => entry.version > parsed.version);
      return;
    }

    reject(connection.socket, extractSeq(parsed), "malformed message");
  }

  function handleClose(connection: Connection): void {
    connections.delete(connection);
    const roomId = connection.roomId;
    if (!roomId) return;
    if (pendingFolds.get(roomId) === connection.actorId) {
      pendingFolds.delete(roomId);
    }
  }

  const wss = new WebSocketServer({ port: options.port });

  wss.on("connection", (socket) => {
    const connection: Connection = {
      actorId: randomUUID(),
      roomId: null,
      socket,
    };
    connections.add(connection);
    socket.on("message", (data) => handleMessage(connection, data));
    socket.on("close", () => handleClose(connection));
    socket.on("error", () => handleClose(connection));
  });

  return new Promise((resolve, rejectPromise) => {
    wss.on("error", rejectPromise);
    wss.on("listening", () => {
      const address = wss.address();
      const boundPort =
        typeof address === "object" && address !== null
          ? address.port
          : options.port;
      resolve({
        port: boundPort,
        close: () =>
          new Promise((resolveClose) => {
            for (const connection of connections) connection.socket.terminate();
            wss.close(() => resolveClose());
          }),
      });
    });
  });
}

function extractSeq(value: unknown): number | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "seq" in value &&
    typeof value.seq === "number"
  ) {
    return value.seq;
  }
  return null;
}
