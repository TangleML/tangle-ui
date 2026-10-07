import type { Patch, SerializedActionCall } from "mobx-keystone";

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

/** @public */
export interface CollabPosition {
  x: number;
  y: number;
}

/** @public */
export interface CollabDragState {
  taskId: string;
  position: CollabPosition;
}

/**
 * A captured mobx-keystone action, replayed on every replica by running `call`
 * and then adopting `newModelIds`. The ids are the model ids the action
 * generated on the originating replica (e.g. the `Binding` created by
 * `connectNodes`), in creation order; each applier re-derives the matching
 * leaf positions locally, so convergence does not depend on absolute indices.
 */
interface SerializedActionCommand {
  kind: "action";
  call: SerializedActionCall;
  newModelIds: string[];
}

/**
 * Fallback for actions whose arguments cannot be serialized (predicate
 * closures such as `removeAllBindingsBy`). The recorded forward patches are
 * replayed verbatim; they rebase coarsely but keep the action routable.
 */
interface PatchesCommand {
  kind: "patches";
  label: string;
  patches: Patch[];
}

export type CollabCommand = SerializedActionCommand | PatchesCommand;

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
  snapshot?: CollabSnapshot;
}

export interface CommandMessage {
  type: "command";
  seq: number;
  command: CollabCommand;
}

export interface SnapshotMessage {
  type: "snapshot";
  version: number;
  snapshot: CollabSnapshot;
}

export interface PresenceMessage {
  type: "presence";
  color: string;
}

export interface PointerMessage {
  type: "pointer";
  position: CollabPosition;
}

export interface DragMessage {
  type: "drag";
  drags: CollabDragState[];
}

export type ClientMessage =
  | JoinMessage
  | CommandMessage
  | SnapshotMessage
  | PresenceMessage
  | PointerMessage
  | DragMessage;

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

export interface SnapshotRequestMessage {
  type: "snapshotRequest";
  version: number;
}

export interface ParticipantInfo {
  actorId: string;
  color: string;
  position?: CollabPosition;
  drags?: CollabDragState[];
}

export interface ParticipantsMessage {
  type: "participants";
  actors: ParticipantInfo[];
}

export interface PointerBroadcastMessage {
  type: "pointer";
  actorId: string;
  position: CollabPosition;
}

export interface DragBroadcastMessage {
  type: "drag";
  actorId: string;
  drags: CollabDragState[];
}

export type ServerMessage =
  | HelloMessage
  | BroadcastMessage
  | RejectMessage
  | SnapshotRequestMessage
  | ParticipantsMessage
  | PointerBroadcastMessage
  | DragBroadcastMessage;

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

function isPosition(value: unknown): value is CollabPosition {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

function isDragState(value: unknown): value is CollabDragState {
  return (
    isRecord(value) &&
    typeof value.taskId === "string" &&
    isPosition(value.position)
  );
}

function isDragStateArray(value: unknown): value is CollabDragState[] {
  return Array.isArray(value) && value.every(isDragState);
}

function isPath(value: unknown): value is (string | number)[] {
  return (
    Array.isArray(value) &&
    value.every((part) => typeof part === "string" || typeof part === "number")
  );
}

function isPatch(value: unknown): value is Patch {
  return (
    isRecord(value) &&
    (value.op === "add" || value.op === "replace" || value.op === "remove") &&
    isPath(value.path)
  );
}

function isSerializedActionCall(value: unknown): value is SerializedActionCall {
  return (
    isRecord(value) &&
    typeof value.actionName === "string" &&
    Array.isArray(value.args) &&
    isPath(value.targetPath) &&
    Array.isArray(value.targetPathIds) &&
    value.targetPathIds.every((id) => id === null || typeof id === "string") &&
    value.serialized === true
  );
}

export function isCollabCommand(value: unknown): value is CollabCommand {
  if (!isRecord(value)) return false;
  if (value.kind === "action") {
    return (
      isSerializedActionCall(value.call) &&
      Array.isArray(value.newModelIds) &&
      value.newModelIds.every((id) => typeof id === "string")
    );
  }
  if (value.kind === "patches") {
    return (
      typeof value.label === "string" &&
      Array.isArray(value.patches) &&
      value.patches.every(isPatch)
    );
  }
  return false;
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
    (value.snapshot === undefined || isCollabSnapshot(value.snapshot))
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

export function isSnapshotMessage(value: unknown): value is SnapshotMessage {
  return (
    isRecord(value) &&
    value.type === "snapshot" &&
    typeof value.version === "number" &&
    isCollabSnapshot(value.snapshot)
  );
}

export function isSnapshotRequestMessage(
  value: unknown,
): value is SnapshotRequestMessage {
  return (
    isRecord(value) &&
    value.type === "snapshotRequest" &&
    typeof value.version === "number"
  );
}

export function isPresenceMessage(value: unknown): value is PresenceMessage {
  return (
    isRecord(value) &&
    value.type === "presence" &&
    typeof value.color === "string"
  );
}

export function isPointerMessage(value: unknown): value is PointerMessage {
  return (
    isRecord(value) && value.type === "pointer" && isPosition(value.position)
  );
}

export function isDragMessage(value: unknown): value is DragMessage {
  return (
    isRecord(value) && value.type === "drag" && isDragStateArray(value.drags)
  );
}

function isParticipantInfo(value: unknown): value is ParticipantInfo {
  return (
    isRecord(value) &&
    typeof value.actorId === "string" &&
    typeof value.color === "string" &&
    (value.position === undefined || isPosition(value.position)) &&
    (value.drags === undefined || isDragStateArray(value.drags))
  );
}

function isParticipantsMessage(value: unknown): value is ParticipantsMessage {
  return (
    isRecord(value) &&
    value.type === "participants" &&
    Array.isArray(value.actors) &&
    value.actors.every(isParticipantInfo)
  );
}

function isPointerBroadcastMessage(
  value: unknown,
): value is PointerBroadcastMessage {
  return (
    isRecord(value) &&
    value.type === "pointer" &&
    typeof value.actorId === "string" &&
    isPosition(value.position)
  );
}

function isDragBroadcastMessage(value: unknown): value is DragBroadcastMessage {
  return (
    isRecord(value) &&
    value.type === "drag" &&
    typeof value.actorId === "string" &&
    isDragStateArray(value.drags)
  );
}

export function isClientMessage(value: unknown): value is ClientMessage {
  return (
    isJoinMessage(value) ||
    isCommandMessage(value) ||
    isSnapshotMessage(value) ||
    isPresenceMessage(value) ||
    isPointerMessage(value) ||
    isDragMessage(value)
  );
}

export function isServerMessage(value: unknown): value is ServerMessage {
  return (
    isHelloMessage(value) ||
    isBroadcastMessage(value) ||
    isRejectMessage(value) ||
    isSnapshotRequestMessage(value) ||
    isParticipantsMessage(value) ||
    isPointerBroadcastMessage(value) ||
    isDragBroadcastMessage(value)
  );
}
