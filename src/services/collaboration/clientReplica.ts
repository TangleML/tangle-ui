import type { Patch } from "mobx-keystone";
import { applyPatches, patchRecorder, standaloneAction } from "mobx-keystone";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";

import { applyCommand } from "./commands/applyCommand";
import type {
  BroadcastMessage,
  CollabCommand,
  CommandMessage,
} from "./protocol";

interface PendingCommand {
  seq: number;
  command: CollabCommand;
  inverse: Patch[][] | null;
}

interface ApplyResult {
  ok: boolean;
  inverse: Patch[][];
}

function applyRecording(
  root: ComponentSpec,
  command: CollabCommand,
): ApplyResult {
  const recorder = patchRecorder(root, { recording: true });
  let ok = true;
  try {
    applyCommand(root, command);
  } catch {
    ok = false;
  }
  recorder.recording = false;
  const inverse = recorder.events.map((event) => event.inversePatches);
  recorder.dispose();
  return { ok, inverse };
}

function rewind(root: ComponentSpec, inverse: Patch[][]): void {
  for (let i = inverse.length - 1; i >= 0; i--) {
    applyPatches(root, inverse[i], true);
  }
}

const rebase = standaloneAction(
  "collab/rebase",
  (
    root: ComponentSpec,
    pending: PendingCommand[],
    dropped: CollabCommand[],
    remote: CollabCommand,
  ): void => {
    for (let i = pending.length - 1; i >= 0; i--) {
      const inverse = pending[i].inverse;
      if (inverse) rewind(root, inverse);
    }

    try {
      applyCommand(root, remote);
    } catch {
      // A semantically impossible command is a no-op on every replica.
    }

    for (const entry of pending) {
      const result = applyRecording(root, entry.command);
      if (result.ok) {
        entry.inverse = result.inverse;
      } else {
        rewind(root, result.inverse);
        entry.inverse = null;
        dropped.push(entry.command);
      }
    }
  },
);

export class ClientReplica {
  readonly actorId: string;
  readonly dropped: CollabCommand[] = [];

  private readonly root: ComponentSpec;
  private readonly pending: PendingCommand[] = [];
  private confirmedVersion: number;
  private nextSeq = 1;

  constructor(actorId: string, root: ComponentSpec, confirmedVersion = 0) {
    this.actorId = actorId;
    this.root = root;
    this.confirmedVersion = confirmedVersion;
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

  applyLocal(command: CollabCommand): CommandMessage | null {
    const result = applyRecording(this.root, command);
    if (!result.ok) {
      rewind(this.root, result.inverse);
      return null;
    }
    const seq = this.nextSeq++;
    this.pending.push({ seq, command, inverse: result.inverse });
    return { type: "command", seq, command };
  }

  receive(message: BroadcastMessage): void {
    if (message.actorId === this.actorId) {
      this.confirmOwnEcho(message);
      return;
    }
    rebase(this.root, this.pending, this.dropped, message.command);
    this.confirmedVersion = message.version;
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
