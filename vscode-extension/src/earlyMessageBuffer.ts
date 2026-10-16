import type {
  RemoteEnvironmentHandlers,
  RemoteKillCommand,
  RemoteMessageCommand,
} from "@tangent/remote-subagent";

const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_MESSAGES = 10;
const DEFAULT_SWEEP_INTERVAL_MS = 30_000;

type MessageHandler = (command: RemoteMessageCommand) => void | Promise<void>;
type KillHandler = (command: RemoteKillCommand) => void | Promise<void>;

interface BufferedMessage {
  agentId: string;
  command: RemoteMessageCommand;
  enqueuedAt: number;
}

export interface EarlyMessageBufferOptions {
  ttlMs?: number;
  maxMessages?: number;
  sweepIntervalMs?: number;
  now?: () => number;
}

/**
 * Holds messages addressed to a local sub-agent that is spawning but not yet
 * live. The Shell can deliver the first `message` before the bridge has
 * constructed the `PiAgent`, in which case the bridge would log
 * `message for unknown sub-agent` and drop it. This buffers such messages,
 * keyed by the server-assigned agentId, and replays them in arrival order once
 * `markReady` reports the agent is running. Unclaimed ids are bounded by a TTL
 * and a global cap so a never-spawned id cannot grow the buffer without bound.
 */
export class EarlyMessageBuffer {
  private readonly log: (line: string) => void;
  private readonly ttlMs: number;
  private readonly maxMessages: number;
  private readonly sweepIntervalMs: number;
  private readonly now: () => number;
  private readonly ready = new Set<string>();
  private buffer: BufferedMessage[] = [];
  private deliver: MessageHandler | undefined;
  private sweepTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    log: (line: string) => void,
    options: EarlyMessageBufferOptions = {},
  ) {
    this.log = log;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;
    this.sweepIntervalMs = options.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Wraps the bridge's handlers so inbound messages route through the buffer.
   * Re-called on every (re)connect to track the live socket's `onMessage` while
   * the buffered state persists across reconnects.
   */
  wrap(
    handlers: Partial<RemoteEnvironmentHandlers> | undefined,
  ): Partial<RemoteEnvironmentHandlers> {
    const delegate = handlers ?? {};
    this.deliver = delegate.onMessage;
    this.startTimer();
    return {
      ...delegate,
      onMessage: (command) => this.onMessage(command),
      onKill: (command) => this.onKill(delegate.onKill, command),
    };
  }

  markReady(agentId: string): void {
    this.ready.add(agentId);
    const pending = this.buffer.filter((entry) => entry.agentId === agentId);
    if (pending.length === 0) return;
    this.buffer = this.buffer.filter((entry) => entry.agentId !== agentId);
    this.log(
      `flushing ${pending.length} buffered message(s) to sub-agent ${agentId}`,
    );
    for (const entry of pending) void this.deliver?.(entry.command);
  }

  sweep(): void {
    const cutoff = this.now() - this.ttlMs;
    const expired = this.buffer.filter((entry) => entry.enqueuedAt < cutoff);
    if (expired.length === 0) return;
    this.buffer = this.buffer.filter((entry) => entry.enqueuedAt >= cutoff);
    for (const agentId of new Set(expired.map((entry) => entry.agentId))) {
      this.log(
        `discarded buffered message(s) for sub-agent ${agentId} after no spawn within ${this.ttlMs}ms`,
      );
    }
  }

  reset(): void {
    this.ready.clear();
    this.buffer = [];
    this.deliver = undefined;
    this.stopTimer();
  }

  private onMessage(command: RemoteMessageCommand): void {
    if (this.ready.has(command.agentId)) {
      void this.deliver?.(command);
      return;
    }
    this.enqueue(command);
  }

  private onKill(
    delegate: KillHandler | undefined,
    command: RemoteKillCommand,
  ): void {
    this.ready.delete(command.agentId);
    this.buffer = this.buffer.filter(
      (entry) => entry.agentId !== command.agentId,
    );
    void delegate?.(command);
  }

  private enqueue(command: RemoteMessageCommand): void {
    this.sweep();
    this.buffer.push({
      agentId: command.agentId,
      command,
      enqueuedAt: this.now(),
    });
    if (this.buffer.length > this.maxMessages) {
      const dropped = this.buffer.shift();
      if (dropped) {
        this.log(
          `early-message buffer full; dropped oldest message for sub-agent ${dropped.agentId}`,
        );
      }
    }
    this.log(`buffered message for pending sub-agent ${command.agentId}`);
  }

  private startTimer(): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweep(), this.sweepIntervalMs);
    this.sweepTimer.unref?.();
  }

  private stopTimer(): void {
    if (!this.sweepTimer) return;
    clearInterval(this.sweepTimer);
    this.sweepTimer = undefined;
  }
}
