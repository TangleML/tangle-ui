import { action, makeObservable, observable } from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";
import { ClientReplica } from "@/services/collaboration/clientReplica";
import type {
  BroadcastMessage,
  CollabCommand,
  HelloMessage,
  LogEntry,
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

export class CollaborationStore {
  @observable accessor enabled = false;
  @observable accessor connectionState: ConnectionState = "closed";
  @observable accessor actorId: string | null = null;
  @observable accessor version = 0;
  @observable.shallow accessor pending: CollabCommand[] = [];
  @observable.shallow accessor dropped: CollabCommand[] = [];
  @observable.shallow accessor log: LogEntry[] = [];
  @observable.shallow accessor rejects: RejectMessage[] = [];

  private root: ComponentSpec | null = null;
  private replica: ClientReplica | null = null;
  private transport: CollabTransport | null = null;
  private room: string | null = null;
  private unsubscribeState: (() => void) | null = null;

  constructor() {
    makeObservable(this);
  }

  @action init(root: ComponentSpec, room: string, serverUrl: string): void {
    this.dispose();
    this.root = root;
    this.room = room;
    this.enabled = true;

    const transport = new WebSocketCollabTransport(serverUrl);
    this.transport = transport;
    transport.onMessage((message) => this.handleMessage(message));
    this.unsubscribeState = transport.subscribe((state) =>
      this.handleState(state),
    );
    transport.connect();
  }

  @action dispatch(command: CollabCommand): void {
    if (!this.replica || !this.transport) return;
    const message = this.replica.applyLocal(command);
    this.syncFromReplica();
    if (message) this.transport.send(message);
  }

  @action dispose(): void {
    this.unsubscribeState?.();
    this.unsubscribeState = null;
    this.transport?.close();
    this.transport = null;
    this.replica = null;
    this.root = null;
    this.room = null;
    this.enabled = false;
    this.connectionState = "closed";
    this.actorId = null;
    this.version = 0;
    this.pending = [];
    this.dropped = [];
    this.log = [];
    this.rejects = [];
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
      snapshot: toCollabSnapshot(this.root),
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
        this.rejects.push(message);
        break;
    }
  }

  @action private handleHello(message: HelloMessage): void {
    if (!this.root) return;
    this.actorId = message.actorId;

    const snapshotVersion =
      message.log.length > 0 ? message.log[0].version - 1 : message.version;
    const previousPending = this.replica
      ? [...this.replica.pendingCommands]
      : [];

    applyCollabSnapshot(this.root, message.snapshot);

    const replica = new ClientReplica(
      message.actorId,
      this.root,
      snapshotVersion,
    );
    for (const entry of message.log) {
      replica.receive({ type: "broadcast", ...entry });
    }
    this.replica = replica;
    this.log = [...message.log];
    this.syncFromReplica();

    for (const command of previousPending) {
      this.dispatch(command);
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
