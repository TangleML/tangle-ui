import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { type RawData, type WebSocket, WebSocketServer } from "ws";

import {
  COLLAB_MODEL_VERSION,
  COLLAB_PROTOCOL_VERSION,
  type HelloMessage,
  isCommandMessage,
  isDragMessage,
  isJoinMessage,
  isPointerMessage,
  isPresenceMessage,
  isSnapshotMessage,
  type JoinMessage,
  type LogEntry,
  type ParticipantInfo,
  type ParticipantsMessage,
  type ServerMessage,
  type SnapshotRequestMessage,
} from "../src/services/collaboration/protocol";
import { roomStateToPlainSpec, specToCollabSnapshot } from "./csom";
import { createHttpHandler } from "./httpRoutes";
import type { PipelineRepository } from "./pipelineRepository";
import { InMemoryRoomStore, type RoomState, type RoomStore } from "./roomStore";

const PERSIST_DEBOUNCE_MS = 1500;

export interface CollabServerOptions {
  port: number;
  logFoldAt: number;
  repository: PipelineRepository;
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
  const { repository } = options;
  const store = options.store ?? new InMemoryRoomStore();
  const connections = new Set<Connection>();
  const pendingFolds = new Map<string, string>();
  const seedsInFlight = new Map<string, Promise<void>>();
  const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function send(socket: WebSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }

  function reject(socket: WebSocket, seq: number | null, reason: string): void {
    send(socket, { type: "reject", seq, reason });
  }

  async function persistRoom(roomId: string): Promise<void> {
    const room = store.get(roomId);
    if (!room?.storageKey) return;
    try {
      await repository.save(room.storageKey, roomStateToPlainSpec(room));
      console.log(
        `flushed room ${roomId} to ${repository.mode} storage ${room.storageKey} (version ${room.version})`,
      );
    } catch (error) {
      console.warn(`failed to persist room ${roomId}`, error);
    }
  }

  function schedulePersist(roomId: string): void {
    const room = store.get(roomId);
    if (!room?.storageKey) return;
    const existing = persistTimers.get(roomId);
    if (existing) clearTimeout(existing);
    persistTimers.set(
      roomId,
      setTimeout(() => {
        persistTimers.delete(roomId);
        void persistRoom(roomId);
      }, PERSIST_DEBOUNCE_MS),
    );
  }

  function flushPersist(roomId: string): void {
    const existing = persistTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      persistTimers.delete(roomId);
    }
    void persistRoom(roomId);
  }

  function roomHasConnections(roomId: string): boolean {
    for (const connection of connections) {
      if (connection.roomId === roomId) return true;
    }
    return false;
  }

  async function seedRoom(
    roomId: string,
    clientSnapshot: JoinMessage["snapshot"],
  ): Promise<RoomState | undefined> {
    const inFlight = seedsInFlight.get(roomId);
    if (inFlight) {
      await inFlight;
      return store.get(roomId);
    }

    const task = (async () => {
      try {
        const pipeline = await repository.load(roomId);
        if (pipeline) {
          store.create(
            roomId,
            specToCollabSnapshot(pipeline.spec),
            pipeline.storageKey,
          );
          return;
        }
      } catch (error) {
        console.warn(
          `failed to seed room ${roomId} from ${repository.mode} storage`,
          error,
        );
      }
      if (clientSnapshot) store.create(roomId, clientSnapshot);
    })();

    seedsInFlight.set(roomId, task);
    try {
      await task;
    } finally {
      seedsInFlight.delete(roomId);
    }
    return store.get(roomId);
  }

  function broadcastToRoom(roomId: string, message: ServerMessage): void {
    for (const connection of connections) {
      if (connection.roomId === roomId) send(connection.socket, message);
    }
  }

  function participantsMessage(room: RoomState): ParticipantsMessage {
    const actors: ParticipantInfo[] = [];
    for (const [actorId, participant] of room.participants) {
      if (participant.color) {
        actors.push({
          actorId,
          color: participant.color,
          position: participant.position,
          drags: participant.drags,
        });
      }
    }
    return { type: "participants", actors };
  }

  function broadcastParticipants(roomId: string): void {
    const room = store.get(roomId);
    if (!room) return;
    broadcastToRoom(roomId, participantsMessage(room));
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

  async function handleJoin(
    connection: Connection,
    parsed: JoinMessage,
  ): Promise<void> {
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

    connection.roomId = parsed.room;
    const room =
      store.get(parsed.room) ?? (await seedRoom(parsed.room, parsed.snapshot));
    if (!room) {
      reject(connection.socket, null, `room ${parsed.room} is unavailable`);
      connection.socket.close();
      return;
    }

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

    if (!room.participants.has(connection.actorId)) {
      room.participants.set(connection.actorId, {});
    }
    send(connection.socket, participantsMessage(room));
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
      void handleJoin(connection, parsed).catch((error) =>
        console.warn("failed to handle join", error),
      );
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
      schedulePersist(roomId);
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

    if (isPresenceMessage(parsed)) {
      const roomId = connection.roomId;
      if (!roomId) return;
      const room = store.get(roomId);
      if (!room) return;
      const participant = room.participants.get(connection.actorId) ?? {};
      participant.color = parsed.color;
      room.participants.set(connection.actorId, participant);
      broadcastParticipants(roomId);
      return;
    }

    if (isPointerMessage(parsed)) {
      const roomId = connection.roomId;
      if (!roomId) return;
      const room = store.get(roomId);
      if (!room) return;
      const participant = room.participants.get(connection.actorId) ?? {};
      participant.position = parsed.position;
      room.participants.set(connection.actorId, participant);
      broadcastToRoom(roomId, {
        type: "pointer",
        actorId: connection.actorId,
        position: parsed.position,
      });
      return;
    }

    if (isDragMessage(parsed)) {
      const roomId = connection.roomId;
      if (!roomId) return;
      const room = store.get(roomId);
      if (!room) return;
      const participant = room.participants.get(connection.actorId) ?? {};
      participant.drags = parsed.drags;
      room.participants.set(connection.actorId, participant);
      broadcastToRoom(roomId, {
        type: "drag",
        actorId: connection.actorId,
        drags: parsed.drags,
      });
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
    const room = store.get(roomId);
    if (room?.participants.delete(connection.actorId)) {
      broadcastParticipants(roomId);
    }
    if (!roomHasConnections(roomId)) {
      flushPersist(roomId);
    }
  }

  const httpServer = createServer(createHttpHandler(repository));
  const wss = new WebSocketServer({ server: httpServer });

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
    httpServer.on("error", rejectPromise);
    httpServer.listen(options.port, () => {
      const address = httpServer.address();
      const boundPort =
        typeof address === "object" && address !== null
          ? address.port
          : options.port;
      resolve({
        port: boundPort,
        close: () =>
          new Promise((resolveClose) => {
            for (const connection of connections) connection.socket.terminate();
            wss.close(() => {
              httpServer.closeAllConnections();
              httpServer.close(() => resolveClose());
            });
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
