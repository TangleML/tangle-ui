export const COLLAB_PROTOCOL_VERSION = 1;
export const COLLAB_MODEL_VERSION = 1;

export type CollabJsonValue =
  | string
  | number
  | boolean
  | null
  | CollabJsonValue[]
  | { [key: string]: CollabJsonValue };

export type CollabJsonObject = { [key: string]: CollabJsonValue };

export interface CollabEndpoint {
  entityId: string;
  portName: string;
}

/** @public */
export interface CollabPosition {
  x: number;
  y: number;
}

export type CollabCommand =
  | { type: "addTask"; task: CollabJsonObject }
  | { type: "deleteTask"; taskId: string }
  | { type: "renameTask"; taskId: string; name: string }
  | { type: "setTaskPosition"; taskId: string; position: CollabPosition }
  | {
      type: "setTaskArgument";
      taskId: string;
      portName: string;
      value: CollabJsonValue;
    }
  | {
      type: "connectNodes";
      bindingId: string;
      source: CollabEndpoint;
      target: CollabEndpoint;
    }
  | { type: "deleteEdge"; bindingId: string };

export interface CollabSnapshot {
  modelVersion: number;
  spec: CollabJsonObject;
}

/** @public */
export interface LogEntry {
  version: number;
  actorId: string;
  seq: number;
  command: CollabCommand;
}

export interface JoinMessage {
  type: "join";
  protocolVersion: number;
  modelVersion: number;
  room: string;
  snapshot: CollabSnapshot;
}

export interface CommandMessage {
  type: "command";
  seq: number;
  command: CollabCommand;
}

export type ClientMessage = JoinMessage | CommandMessage;

export interface HelloMessage {
  type: "hello";
  protocolVersion: number;
  modelVersion: number;
  actorId: string;
  version: number;
  snapshot: CollabSnapshot;
  log: LogEntry[];
}

export interface BroadcastMessage {
  type: "broadcast";
  version: number;
  actorId: string;
  seq: number;
  command: CollabCommand;
}

export interface RejectMessage {
  type: "reject";
  seq: number | null;
  reason: string;
}

export type ServerMessage = HelloMessage | BroadcastMessage | RejectMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is CollabJsonValue {
  if (value === null) return true;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
}

function isJsonObject(value: unknown): value is CollabJsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isEndpoint(value: unknown): value is CollabEndpoint {
  return (
    isRecord(value) &&
    typeof value.entityId === "string" &&
    typeof value.portName === "string"
  );
}

function isPosition(value: unknown): value is CollabPosition {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

export function isCollabCommand(value: unknown): value is CollabCommand {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "addTask":
      return isJsonObject(value.task);
    case "deleteTask":
      return typeof value.taskId === "string";
    case "renameTask":
      return typeof value.taskId === "string" && typeof value.name === "string";
    case "setTaskPosition":
      return typeof value.taskId === "string" && isPosition(value.position);
    case "setTaskArgument":
      return (
        typeof value.taskId === "string" &&
        typeof value.portName === "string" &&
        isJsonValue(value.value)
      );
    case "connectNodes":
      return (
        typeof value.bindingId === "string" &&
        isEndpoint(value.source) &&
        isEndpoint(value.target)
      );
    case "deleteEdge":
      return typeof value.bindingId === "string";
    default:
      return false;
  }
}

function isCollabSnapshot(value: unknown): value is CollabSnapshot {
  return (
    isRecord(value) &&
    typeof value.modelVersion === "number" &&
    isJsonObject(value.spec)
  );
}

function isLogEntry(value: unknown): value is LogEntry {
  return (
    isRecord(value) &&
    typeof value.version === "number" &&
    typeof value.actorId === "string" &&
    typeof value.seq === "number" &&
    isCollabCommand(value.command)
  );
}

export function isJoinMessage(value: unknown): value is JoinMessage {
  return (
    isRecord(value) &&
    value.type === "join" &&
    typeof value.protocolVersion === "number" &&
    typeof value.modelVersion === "number" &&
    typeof value.room === "string" &&
    isCollabSnapshot(value.snapshot)
  );
}

export function isCommandMessage(value: unknown): value is CommandMessage {
  return (
    isRecord(value) &&
    value.type === "command" &&
    typeof value.seq === "number" &&
    isCollabCommand(value.command)
  );
}

export function isHelloMessage(value: unknown): value is HelloMessage {
  return (
    isRecord(value) &&
    value.type === "hello" &&
    typeof value.protocolVersion === "number" &&
    typeof value.modelVersion === "number" &&
    typeof value.actorId === "string" &&
    typeof value.version === "number" &&
    isCollabSnapshot(value.snapshot) &&
    Array.isArray(value.log) &&
    value.log.every(isLogEntry)
  );
}

export function isBroadcastMessage(value: unknown): value is BroadcastMessage {
  return (
    isRecord(value) &&
    value.type === "broadcast" &&
    typeof value.version === "number" &&
    typeof value.actorId === "string" &&
    typeof value.seq === "number" &&
    isCollabCommand(value.command)
  );
}

export function isRejectMessage(value: unknown): value is RejectMessage {
  return (
    isRecord(value) &&
    value.type === "reject" &&
    (value.seq === null || typeof value.seq === "number") &&
    typeof value.reason === "string"
  );
}

export function isClientMessage(value: unknown): value is ClientMessage {
  return isJoinMessage(value) || isCommandMessage(value);
}

export function isServerMessage(value: unknown): value is ServerMessage {
  return (
    isHelloMessage(value) || isBroadcastMessage(value) || isRejectMessage(value)
  );
}
