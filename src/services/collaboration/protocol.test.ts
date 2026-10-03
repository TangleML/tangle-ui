import { describe, expect, it } from "vitest";

import type { CollabCommand, CollabSnapshot } from "./protocol";
import {
  COLLAB_MODEL_VERSION,
  COLLAB_PROTOCOL_VERSION,
  isBroadcastMessage,
  isClientMessage,
  isCollabCommand,
  isCommandMessage,
  isHelloMessage,
  isJoinMessage,
  isRejectMessage,
  isServerMessage,
} from "./protocol";

const snapshot: CollabSnapshot = {
  modelVersion: COLLAB_MODEL_VERSION,
  spec: { $modelType: "spec/ComponentSpec", $id: "spec_1", name: "P" },
};

const addTask: CollabCommand = {
  type: "addTask",
  task: { $modelType: "spec/Task", $id: "task_1", name: "T" },
};

describe("isCollabCommand", () => {
  it("accepts every verb in the union", () => {
    const commands: CollabCommand[] = [
      addTask,
      { type: "deleteTask", taskId: "task_1" },
      { type: "renameTask", taskId: "task_1", name: "New" },
      { type: "setTaskPosition", taskId: "task_1", position: { x: 1, y: 2 } },
      {
        type: "setTaskArgument",
        taskId: "task_1",
        portName: "path",
        value: "/data",
      },
      {
        type: "connectNodes",
        bindingId: "binding_1",
        source: { entityId: "task_1", portName: "out" },
        target: { entityId: "task_2", portName: "in" },
      },
      { type: "deleteEdge", bindingId: "binding_1" },
    ];
    for (const command of commands) {
      expect(isCollabCommand(command)).toBe(true);
    }
  });

  it("rejects unknown verbs and malformed operands", () => {
    expect(isCollabCommand({ type: "frobnicate" })).toBe(false);
    expect(isCollabCommand({ type: "deleteTask" })).toBe(false);
    expect(isCollabCommand({ type: "deleteTask", taskId: 7 })).toBe(false);
    expect(
      isCollabCommand({ type: "setTaskPosition", taskId: "t", position: {} }),
    ).toBe(false);
    expect(
      isCollabCommand({
        type: "connectNodes",
        bindingId: "b",
        source: { entityId: "t" },
        target: { entityId: "t2", portName: "in" },
      }),
    ).toBe(false);
    expect(isCollabCommand(null)).toBe(false);
    expect(isCollabCommand("addTask")).toBe(false);
  });
});

describe("client message guards", () => {
  it("accepts a join message", () => {
    const join = {
      type: "join",
      protocolVersion: COLLAB_PROTOCOL_VERSION,
      modelVersion: COLLAB_MODEL_VERSION,
      room: "room-1",
      snapshot,
    };
    expect(isJoinMessage(join)).toBe(true);
    expect(isClientMessage(join)).toBe(true);
    expect(isServerMessage(join)).toBe(false);
  });

  it("accepts a command message", () => {
    const command = { type: "command", seq: 1, command: addTask };
    expect(isCommandMessage(command)).toBe(true);
    expect(isClientMessage(command)).toBe(true);
  });

  it("rejects a command message with a bad command", () => {
    expect(
      isCommandMessage({ type: "command", seq: 1, command: { type: "nope" } }),
    ).toBe(false);
  });
});

describe("server message guards", () => {
  it("accepts a hello message with a log tail", () => {
    const hello = {
      type: "hello",
      protocolVersion: COLLAB_PROTOCOL_VERSION,
      modelVersion: COLLAB_MODEL_VERSION,
      actorId: "actor-1",
      version: 3,
      snapshot,
      log: [{ version: 3, actorId: "actor-2", seq: 5, command: addTask }],
    };
    expect(isHelloMessage(hello)).toBe(true);
    expect(isServerMessage(hello)).toBe(true);
    expect(isClientMessage(hello)).toBe(false);
  });

  it("rejects a hello message whose log holds a bad entry", () => {
    const hello = {
      type: "hello",
      protocolVersion: COLLAB_PROTOCOL_VERSION,
      modelVersion: COLLAB_MODEL_VERSION,
      actorId: "actor-1",
      version: 3,
      snapshot,
      log: [{ version: 3, actorId: "actor-2", seq: 5 }],
    };
    expect(isHelloMessage(hello)).toBe(false);
  });

  it("accepts a broadcast message", () => {
    const broadcast = {
      type: "broadcast",
      version: 7,
      actorId: "actor-1",
      seq: 2,
      command: addTask,
    };
    expect(isBroadcastMessage(broadcast)).toBe(true);
    expect(isServerMessage(broadcast)).toBe(true);
  });

  it("accepts a reject message with a null seq", () => {
    expect(
      isRejectMessage({ type: "reject", seq: null, reason: "modelVersion" }),
    ).toBe(true);
    expect(
      isRejectMessage({ type: "reject", seq: 4, reason: "bad shape" }),
    ).toBe(true);
    expect(isRejectMessage({ type: "reject", reason: "no seq" })).toBe(false);
  });
});
