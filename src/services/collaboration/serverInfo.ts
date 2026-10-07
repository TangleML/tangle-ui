export type CollabStorageMode = "ephemeral" | "backend";

export interface CollabServerInfo {
  storage: CollabStorageMode;
}

export interface CreateRoomResponse {
  roomId: string;
}

export const COLLAB_HTTP_ROUTES = {
  info: "/info",
  rooms: "/rooms",
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isCollabStorageMode(
  value: unknown,
): value is CollabStorageMode {
  return value === "ephemeral" || value === "backend";
}

export function isCollabServerInfo(value: unknown): value is CollabServerInfo {
  return isObject(value) && isCollabStorageMode(value.storage);
}

export function isCreateRoomResponse(
  value: unknown,
): value is CreateRoomResponse {
  return (
    isObject(value) &&
    typeof value.roomId === "string" &&
    value.roomId.length > 0
  );
}
