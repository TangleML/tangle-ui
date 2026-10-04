import type {
  CollabSnapshot,
  LogEntry,
} from "../src/services/collaboration/protocol";

export interface RoomState {
  version: number;
  snapshot: CollabSnapshot;
  snapshotVersion: number;
  log: LogEntry[];
}

export interface RoomStore {
  get(roomId: string): RoomState | undefined;
  create(roomId: string, snapshot: CollabSnapshot): RoomState;
}

export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, RoomState>();

  get(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  create(roomId: string, snapshot: CollabSnapshot): RoomState {
    const room: RoomState = {
      version: 0,
      snapshot,
      snapshotVersion: 0,
      log: [],
    };
    this.rooms.set(roomId, room);
    return room;
  }
}
