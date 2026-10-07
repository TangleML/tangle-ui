import type {
  CollabDragState,
  CollabPosition,
  CollabSnapshot,
  LogEntry,
} from "../src/services/collaboration/protocol";

interface Participant {
  color?: string;
  position?: CollabPosition;
  drags?: CollabDragState[];
}

export interface RoomState {
  version: number;
  snapshot: CollabSnapshot;
  snapshotVersion: number;
  log: LogEntry[];
  participants: Map<string, Participant>;
  /** Backend `file_path` to persist to, when the room is a backend pipeline. */
  filePath?: string;
}

export interface RoomStore {
  get(roomId: string): RoomState | undefined;
  create(
    roomId: string,
    snapshot: CollabSnapshot,
    filePath?: string,
  ): RoomState;
}

export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, RoomState>();

  get(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  create(
    roomId: string,
    snapshot: CollabSnapshot,
    filePath?: string,
  ): RoomState {
    const room: RoomState = {
      version: 0,
      snapshot,
      snapshotVersion: 0,
      log: [],
      participants: new Map(),
      filePath,
    };
    this.rooms.set(roomId, room);
    return room;
  }
}
