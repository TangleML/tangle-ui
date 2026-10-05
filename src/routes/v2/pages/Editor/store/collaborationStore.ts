import { action, makeObservable, observable } from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";
import type {
  ActionCapture,
  CapturedAction,
} from "@/services/collaboration/actionCapture";
import { installActionCapture } from "@/services/collaboration/actionCapture";
import { ClientReplica } from "@/services/collaboration/clientReplica";
import { pickCursorColor } from "@/services/collaboration/cursorColors";
import type {
  BroadcastMessage,
  CollabCommand,
  CollabDragState,
  CollabPosition,
  DragBroadcastMessage,
  HelloMessage,
  LogEntry,
  ParticipantInfo,
  ParticipantsMessage,
  PointerBroadcastMessage,
  RejectMessage,
  ServerMessage,
} from "@/services/collaboration/protocol";
import {
  COLLAB_MODEL_VERSION,
  COLLAB_PROTOCOL_VERSION,
} from "@/services/collaboration/protocol";
import {
  applyCollabSnapshot,
  toCollabSnapshot,
} from "@/services/collaboration/snapshot";
import type {
  CollabTransport,
  ConnectionState,
} from "@/services/collaboration/transport";
import { WebSocketCollabTransport } from "@/services/collaboration/transport";

const POINTER_THROTTLE_MS = 50;
const DRAG_THROTTLE_MS = 50;

export class CollaborationStore {
  @observable accessor enabled = false;
  @observable accessor connectionState: ConnectionState = "closed";
  @observable accessor actorId: string | null = null;
  @observable accessor version = 0;
  @observable accessor localColor = "";
  @observable.shallow accessor pending: CollabCommand[] = [];
  @observable.shallow accessor dropped: CollabCommand[] = [];
  @observable.shallow accessor log: LogEntry[] = [];
  @observable.shallow accessor rejects: RejectMessage[] = [];
  @observable.shallow accessor participants: ParticipantInfo[] = [];

  private root: ComponentSpec | null = null;
  private replica: ClientReplica | null = null;
  private transport: CollabTransport | null = null;
  private capture: ActionCapture | null = null;
  private room: string | null = null;
  private seedFromClient = true;
  private preHelloBuffer: CollabCommand[] = [];
  private unsubscribeState: (() => void) | null = null;
  private pointerThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPointer: CollabPosition | null = null;
  private dragThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingDrags: CollabDragState[] | null = null;

  constructor() {
    makeObservable(this);
  }

  @action init(
    root: ComponentSpec,
    room: string,
    serverUrl: string,
    options?: { seedFromClient?: boolean },
  ): void {
    this.dispose();
    this.root = root;
    this.room = room;
    this.seedFromClient = options?.seedFromClient ?? true;
    this.enabled = true;
    this.localColor = pickCursorColor();
    this.capture = installActionCapture(root, (captured) =>
      this.handleCapturedAction(captured),
    );

    const transport = new WebSocketCollabTransport(serverUrl);
    this.transport = transport;
    transport.onMessage((message) => this.handleMessage(message));
    this.unsubscribeState = transport.subscribe((state) =>
      this.handleState(state),
    );
    transport.connect();
  }

  @action dispose(): void {
    this.unsubscribeState?.();
    this.unsubscribeState = null;
    this.capture?.dispose();
    this.capture = null;
    if (this.pointerThrottleTimer) clearTimeout(this.pointerThrottleTimer);
    this.pointerThrottleTimer = null;
    this.pendingPointer = null;
    if (this.dragThrottleTimer) clearTimeout(this.dragThrottleTimer);
    this.dragThrottleTimer = null;
    this.pendingDrags = null;
    this.transport?.close();
    this.transport = null;
    this.replica = null;
    this.root = null;
    this.room = null;
    this.preHelloBuffer = [];
    this.enabled = false;
    this.connectionState = "closed";
    this.actorId = null;
    this.version = 0;
    this.localColor = "";
    this.pending = [];
    this.dropped = [];
    this.log = [];
    this.rejects = [];
    this.participants = [];
  }

  private runBypassed<T>(fn: () => T): T {
    return this.capture ? this.capture.runBypassed(fn) : fn();
  }

  @action private handleCapturedAction(captured: CapturedAction): void {
    if (!this.transport) return;
    if (!this.replica) {
      this.preHelloBuffer.push(captured.command);
      return;
    }
    const message = this.replica.recordLocal(captured);
    this.syncFromReplica();
    this.transport.send(message);
  }

  @action private handleState(state: ConnectionState): void {
    this.connectionState = state;
    if (state === "open") this.sendJoin();
  }

  private sendJoin(): void {
    if (!this.root || !this.room || !this.transport) return;
    this.transport.send({
      type: "join",
      protocolVersion: COLLAB_PROTOCOL_VERSION,
      modelVersion: COLLAB_MODEL_VERSION,
      room: this.room,
      snapshot: this.seedFromClient ? toCollabSnapshot(this.root) : undefined,
    });
  }

  @action private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case "hello":
        this.handleHello(message);
        break;
      case "broadcast":
        this.handleBroadcast(message);
        break;
      case "snapshotRequest":
        this.handleSnapshotRequest();
        break;
      case "reject":
        this.handleReject(message);
        break;
      case "participants":
        this.handleParticipants(message);
        break;
      case "pointer":
        this.handlePointer(message);
        break;
      case "drag":
        this.handleDrag(message);
        break;
    }
  }

  @action private handleParticipants(message: ParticipantsMessage): void {
    this.participants = message.actors;
  }

  @action private handlePointer(message: PointerBroadcastMessage): void {
    if (message.actorId === this.actorId) return;
    this.participants = this.participants.map((actor) =>
      actor.actorId === message.actorId
        ? { ...actor, position: message.position }
        : actor,
    );
  }

  @action private handleDrag(message: DragBroadcastMessage): void {
    if (message.actorId === this.actorId) return;
    this.participants = this.participants.map((actor) =>
      actor.actorId === message.actorId
        ? { ...actor, drags: message.drags }
        : actor,
    );
  }

  updateLocalPointer(position: CollabPosition): void {
    if (!this.transport || this.connectionState !== "open") return;
    this.pendingPointer = position;
    if (this.pointerThrottleTimer) return;
    this.flushPointer();
    this.pointerThrottleTimer = setTimeout(() => {
      this.pointerThrottleTimer = null;
      this.flushPointer();
    }, POINTER_THROTTLE_MS);
  }

  private flushPointer(): void {
    if (!this.pendingPointer || !this.transport) return;
    this.transport.send({ type: "pointer", position: this.pendingPointer });
    this.pendingPointer = null;
  }

  updateLocalDrag(drags: CollabDragState[]): void {
    if (!this.transport || this.connectionState !== "open") return;
    this.pendingDrags = drags;
    if (this.dragThrottleTimer) return;
    this.flushDrag();
    this.dragThrottleTimer = setTimeout(() => {
      this.dragThrottleTimer = null;
      this.flushDrag();
    }, DRAG_THROTTLE_MS);
  }

  clearLocalDrag(): void {
    if (this.dragThrottleTimer) clearTimeout(this.dragThrottleTimer);
    this.dragThrottleTimer = null;
    this.pendingDrags = null;
    if (!this.transport || this.connectionState !== "open") return;
    this.transport.send({ type: "drag", drags: [] });
  }

  private flushDrag(): void {
    if (!this.pendingDrags || !this.transport) return;
    this.transport.send({ type: "drag", drags: this.pendingDrags });
    this.pendingDrags = null;
  }

  @action private handleReject(message: RejectMessage): void {
    this.rejects.push(message);
    // A join is rejected with no seq (unavailable room, version mismatch). That
    // is fatal: the WS handshake keeps succeeding, so the transport would reset
    // its backoff and reconnect forever. Close it for good instead of looping.
    if (message.seq === null) {
      this.transport?.close();
    }
  }

  @action private handleHello(message: HelloMessage): void {
    if (!this.root) return;
    this.actorId = message.actorId;
    this.transport?.send({ type: "presence", color: this.localColor });

    const snapshotVersion =
      message.log.length > 0 ? message.log[0].version - 1 : message.version;
    const previousPending = this.replica
      ? [...this.replica.pendingCommands]
      : [];
    const buffered = this.preHelloBuffer;
    this.preHelloBuffer = [];

    const root = this.root;
    const replica = this.runBypassed(() => {
      applyCollabSnapshot(root, message.snapshot);
      const rebuilt = new ClientReplica(message.actorId, root, {
        confirmedVersion: snapshotVersion,
        runBypassed: (fn) => this.runBypassed(fn),
      });
      for (const entry of message.log) {
        rebuilt.receive({ type: "broadcast", ...entry });
      }
      return rebuilt;
    });
    this.replica = replica;
    this.log = [...message.log];
    this.syncFromReplica();

    for (const command of [...previousPending, ...buffered]) {
      const resent = replica.reapplyLocal(command);
      if (!resent) continue;
      this.syncFromReplica();
      this.transport?.send(resent);
    }
  }

  @action private handleBroadcast(message: BroadcastMessage): void {
    if (!this.replica) return;
    this.log.push({
      version: message.version,
      actorId: message.actorId,
      seq: message.seq,
      command: message.command,
    });
    this.replica.receive(message);
    this.syncFromReplica();
  }

  @action private handleSnapshotRequest(): void {
    if (!this.root || !this.replica || !this.transport) return;
    this.transport.send({
      type: "snapshot",
      version: this.replica.version,
      snapshot: toCollabSnapshot(this.root),
    });
  }

  @action private syncFromReplica(): void {
    const replica = this.replica;
    this.version = replica?.version ?? 0;
    this.pending = replica ? [...replica.pendingCommands] : [];
    this.dropped = replica ? [...replica.dropped] : [];
  }
}
