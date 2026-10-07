// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";

import {
  type BroadcastMessage,
  type ClientMessage,
  COLLAB_MODEL_VERSION,
  COLLAB_PROTOCOL_VERSION,
  type HelloMessage,
  isBroadcastMessage,
  isHelloMessage,
  isRejectMessage,
  isServerMessage,
  isSnapshotRequestMessage,
  type RejectMessage,
  type ServerMessage,
} from "../src/services/collaboration/protocol";
import { type CollabServer, createCollabServer } from "./server";

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (cleanup) await cleanup();
  }
});

async function startServer(logFoldAt = 1000): Promise<CollabServer> {
  const server = await createCollabServer({ port: 0, logFoldAt });
  cleanups.push(() => server.close());
  return server;
}

interface TestClient {
  received: ServerMessage[];
  send(message: ClientMessage): void;
  sendRaw(data: string): void;
  waitUntil(predicate: () => boolean): Promise<void>;
  waitFor<T extends ServerMessage>(
    guard: (message: ServerMessage) => message is T,
  ): Promise<T>;
  waitClose(): Promise<void>;
}

function openClient(port: number): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${port}`);
    const received: ServerMessage[] = [];
    const conditionWaiters: Array<{
      predicate: () => boolean;
      resolve: () => void;
    }> = [];

    const closeWaiters: Array<() => void> = [];
    let closed = false;

    function evaluateWaiters(): void {
      for (let i = conditionWaiters.length - 1; i >= 0; i--) {
        if (conditionWaiters[i].predicate()) {
          conditionWaiters[i].resolve();
          conditionWaiters.splice(i, 1);
        }
      }
    }

    function waitUntil(predicate: () => boolean): Promise<void> {
      if (predicate()) return Promise.resolve();
      return new Promise((resolveWait) => {
        conditionWaiters.push({ predicate, resolve: resolveWait });
      });
    }

    async function waitFor<T extends ServerMessage>(
      guard: (message: ServerMessage) => message is T,
    ): Promise<T> {
      await waitUntil(() => received.some(guard));
      const found = received.find(guard);
      if (!found) throw new Error("waitFor resolved without a match");
      return found;
    }

    socket.on("message", (data) => {
      const parsed: unknown = JSON.parse(data.toString());
      if (!isServerMessage(parsed)) return;
      received.push(parsed);
      evaluateWaiters();
    });
    socket.on("close", () => {
      closed = true;
      for (const resolveClose of closeWaiters.splice(0)) resolveClose();
    });
    socket.on("error", reject);
    socket.on("open", () => {
      cleanups.push(
        () =>
          new Promise<void>((resolveClose) => {
            if (socket.readyState === WebSocket.CLOSED) {
              resolveClose();
              return;
            }
            socket.once("close", () => resolveClose());
            socket.close();
          }),
      );
      resolve({
        received,
        send: (message) => socket.send(JSON.stringify(message)),
        sendRaw: (raw) => socket.send(raw),
        waitUntil,
        waitFor,
        waitClose: () =>
          closed
            ? Promise.resolve()
            : new Promise((resolveClose) => closeWaiters.push(resolveClose)),
      });
    });
  });
}

function seedSnapshot(marker: string) {
  return { modelVersion: COLLAB_MODEL_VERSION, spec: { marker } };
}

function join(room: string, marker: string): ClientMessage {
  return {
    type: "join",
    protocolVersion: COLLAB_PROTOCOL_VERSION,
    modelVersion: COLLAB_MODEL_VERSION,
    room,
    snapshot: seedSnapshot(marker),
  };
}

function moveCommand(seq: number, taskId: string): ClientMessage {
  return {
    type: "command",
    seq,
    command: {
      kind: "patches",
      label: `move:${taskId}`,
      patches: [{ op: "replace", path: ["marker"], value: `${taskId}:${seq}` }],
    },
  };
}

function broadcastKeys(client: TestClient): string[] {
  return client.received
    .filter(isBroadcastMessage)
    .map(
      (message: BroadcastMessage) =>
        `${message.version}:${message.actorId}:${message.seq}`,
    );
}

describe("collab sync server", () => {
  it("broadcasts commands to every client in the same total order", async () => {
    const server = await startServer();
    const a = await openClient(server.port);
    const b = await openClient(server.port);

    a.send(join("room", "seed"));
    b.send(join("room", "seed"));
    const helloA = await a.waitFor(isHelloMessage);
    const helloB = await b.waitFor(isHelloMessage);
    expect(helloA.actorId).not.toBe(helloB.actorId);

    a.send(moveCommand(1, "task-a"));
    b.send(moveCommand(1, "task-b"));

    await a.waitUntil(() => a.received.filter(isBroadcastMessage).length === 2);
    await b.waitUntil(() => b.received.filter(isBroadcastMessage).length === 2);

    expect(broadcastKeys(a)).toEqual(broadcastKeys(b));
    const versions = a.received
      .filter(isBroadcastMessage)
      .map((m) => m.version);
    expect(versions).toEqual([1, 2]);
  });

  it("gives a late joiner a snapshot plus the log tail to the current version", async () => {
    const server = await startServer();
    const a = await openClient(server.port);
    a.send(join("late", "origin-seed"));
    await a.waitFor(isHelloMessage);

    a.send(moveCommand(1, "task-1"));
    a.send(moveCommand(2, "task-2"));
    await a.waitUntil(() => a.received.filter(isBroadcastMessage).length === 2);

    const b = await openClient(server.port);
    b.send(join("late", "ignored-seed"));
    const helloB: HelloMessage = await b.waitFor(isHelloMessage);

    expect(helloB.version).toBe(2);
    expect(helloB.snapshot.spec.marker).toBe("origin-seed");
    expect(helloB.log.map((entry) => entry.version)).toEqual([1, 2]);
  });

  it("rejects a malformed message without taking the room down", async () => {
    const server = await startServer();
    const a = await openClient(server.port);
    a.send(join("resilient", "seed"));
    await a.waitFor(isHelloMessage);

    a.sendRaw("this is not json");
    const invalidJson: RejectMessage = await a.waitFor(isRejectMessage);
    expect(invalidJson.seq).toBeNull();

    a.sendRaw(JSON.stringify({ type: "command", seq: 7 }));
    await a.waitUntil(() => a.received.filter(isRejectMessage).length === 2);
    const rejects = a.received.filter(isRejectMessage);
    expect(rejects[1].seq).toBe(7);

    a.send(moveCommand(1, "task-1"));
    await a.waitUntil(() => a.received.some(isBroadcastMessage));
    const broadcast = a.received.find(isBroadcastMessage);
    expect(broadcast?.version).toBe(1);
  });

  it("refuses a modelVersion mismatch at join and closes the connection", async () => {
    const server = await startServer();
    const a = await openClient(server.port);
    a.send({
      type: "join",
      protocolVersion: COLLAB_PROTOCOL_VERSION,
      modelVersion: COLLAB_MODEL_VERSION + 1,
      room: "mismatch",
      snapshot: seedSnapshot("seed"),
    });

    const reject: RejectMessage = await a.waitFor(isRejectMessage);
    expect(reject.seq).toBeNull();
    await a.waitClose();
  });

  it("folds the log on demand via a willing client and still serves late joiners", async () => {
    const server = await startServer(2);
    const a = await openClient(server.port);
    a.send(join("folding", "origin-seed"));
    await a.waitFor(isHelloMessage);

    a.send(moveCommand(1, "task-1"));
    a.send(moveCommand(2, "task-2"));
    a.send(moveCommand(3, "task-3"));

    const request = await a.waitFor(isSnapshotRequestMessage);
    expect(request.version).toBe(3);
    a.send({
      type: "snapshot",
      version: request.version,
      snapshot: {
        modelVersion: COLLAB_MODEL_VERSION,
        spec: { marker: "folded" },
      },
    });

    a.send(moveCommand(4, "task-4"));
    await a.waitUntil(() =>
      a.received.some((m) => isBroadcastMessage(m) && m.version === 4),
    );

    const b = await openClient(server.port);
    b.send(join("folding", "ignored-seed"));
    const helloB: HelloMessage = await b.waitFor(isHelloMessage);

    expect(helloB.version).toBe(4);
    expect(helloB.snapshot.spec.marker).toBe("folded");
    expect(helloB.log.map((entry) => entry.version)).toEqual([4]);
  });
});
