import type { SerializedActionCall } from "mobx-keystone";
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

const addTaskCall: SerializedActionCall = {
  actionName: "addTask",
  args: [
    {
      $mobxKeystoneSerializer: "mobx-keystone/objectSnapshot",
      value: { $modelType: "spec/Task", $id: "task_1", name: "T" },
    },
  ],
  targetPath: [],
  targetPathIds: [],
  serialized: true,
};

const addTask: CollabCommand = {
  kind: "action",
  call: addTaskCall,
  newModelIds: ["task_1"],
};

const patchesCommand: CollabCommand = {
  kind: "patches",
  label: "removeAllBindingsBy",
  patches: [{ op: "remove", path: ["bindings", 0] }],
};

describe("isCollabCommand", () => {
  it("accepts a serialized action command", () => {
    expect(isCollabCommand(addTask)).toBe(true);
  });

  it("accepts a nested target with generated ids", () => {
    const command: CollabCommand = {
      kind: "action",
      call: {
        actionName: "connectNodes",
        args: ["input_2", "task_1"],
        targetPath: [],
        targetPathIds: [],
        serialized: true,
      },
      newModelIds: ["binding_1"],
    };
    expect(isCollabCommand(command)).toBe(true);
  });

  it("accepts a patch-fallback command", () => {
    expect(isCollabCommand(patchesCommand)).toBe(true);
  });

  it("rejects malformed commands", () => {
    expect(isCollabCommand({ kind: "frobnicate" })).toBe(false);
    expect(isCollabCommand({ kind: "action" })).toBe(false);
    expect(isCollabCommand({ kind: "action", call: addTaskCall })).toBe(false);
    expect(
      isCollabCommand({
        kind: "action",
        call: { ...addTaskCall, serialized: false },
        newModelIds: [],
      }),
    ).toBe(false);
    expect(
      isCollabCommand({
        kind: "action",
        call: { ...addTaskCall, targetPathIds: [7] },
        newModelIds: [],
      }),
    ).toBe(false);
    expect(
      isCollabCommand({ kind: "patches", patches: [{ op: "noop" }] }),
    ).toBe(false);
    expect(
      isCollabCommand({ kind: "patches", label: "x", patches: "nope" }),
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
      isCommandMessage({ type: "command", seq: 1, command: { kind: "nope" } }),
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
