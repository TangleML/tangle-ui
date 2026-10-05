import type { Patch } from "mobx-keystone";

import type { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";

import type { CapturedAction } from "./actionCapture";
import type {
  BroadcastMessage,
  CollabCommand,
  CommandMessage,
} from "./protocol";
import { applyCommandRecording, rewind } from "./serializedAction";

interface PendingCommand {
  seq: number;
  command: CollabCommand;
  inverse: Patch[][] | null;
  dropped: boolean;
}

interface ClientReplicaOptions {
  confirmedVersion?: number;
  runBypassed?: <T>(fn: () => T) => T;
}

export class ClientReplica {
  readonly actorId: string;
  readonly dropped: CollabCommand[] = [];

  private readonly root: ComponentSpec;
  private readonly pending: PendingCommand[] = [];
  private readonly runBypassed: <T>(fn: () => T) => T;
  private confirmedVersion: number;
  private nextSeq = 1;

  constructor(
    actorId: string,
    root: ComponentSpec,
    options: ClientReplicaOptions = {},
  ) {
    this.actorId = actorId;
    this.root = root;
    this.confirmedVersion = options.confirmedVersion ?? 0;
    this.runBypassed = options.runBypassed ?? ((fn) => fn());
  }

  get version(): number {
    return this.confirmedVersion;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get pendingCommands(): readonly CollabCommand[] {
    return this.pending.map((entry) => entry.command);
  }

  /** Records a command the capture middleware already applied optimistically. */
  recordLocal(captured: CapturedAction): CommandMessage {
    const seq = this.nextSeq++;
    this.pending.push({
      seq,
      command: captured.command,
      inverse: captured.inverse,
      dropped: false,
    });
    return { type: "command", seq, command: captured.command };
  }

  /**
   * Applies a command to the tree now, then records it as pending. Used to
   * re-dispatch commands that outlived a reconnect/reseed, where the optimistic
   * tree state was replaced by the server snapshot.
   */
  reapplyLocal(command: CollabCommand): CommandMessage | null {
    const result = this.runBypassed(() =>
      applyCommandRecording(this.root, command),
    );
    if (!result.ok) return null;
    const seq = this.nextSeq++;
    this.pending.push({
      seq,
      command,
      inverse: result.inverse,
      dropped: false,
    });
    return { type: "command", seq, command };
  }

  receive(message: BroadcastMessage): void {
    if (message.actorId === this.actorId) {
      this.confirmOwnEcho(message);
      return;
    }
    this.runBypassed(() => this.rebase(message.command));
    this.confirmedVersion = message.version;
  }

  private rebase(remote: CollabCommand): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const inverse = this.pending[i].inverse;
      if (inverse) rewind(this.root, inverse);
    }

    applyCommandRecording(this.root, remote);

    for (const entry of this.pending) {
      const result = applyCommandRecording(this.root, entry.command);
      if (result.ok) {
        entry.inverse = result.inverse;
      } else {
        entry.inverse = null;
        if (!entry.dropped) {
          entry.dropped = true;
          this.dropped.push(entry.command);
        }
      }
    }
  }

  private confirmOwnEcho(message: BroadcastMessage): void {
    const head = this.pending[0];
    if (!head || head.seq !== message.seq) {
      throw new Error(
        `Own echo seq ${message.seq} does not match pending head ${head?.seq ?? "none"}`,
      );
    }
    this.pending.shift();
    this.confirmedVersion = message.version;
  }
}
