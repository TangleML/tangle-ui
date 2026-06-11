import { action, computed, makeObservable, observable } from "mobx";

import { AgentThread } from "./agentThread";

/**
 * Owns the collection of {@link AgentThread}s for one AI chat provider.
 *
 * Today only a single thread is effectively active: starting a new
 * session (or navigating to a different pipeline / run) disposes the
 * current thread and creates a fresh one in one go. The collection shape
 * leaves room for multiple concurrent threads in the future.
 */
export class AiChatStore {
  @observable.shallow accessor threads: AgentThread[] = [];
  @observable accessor activeThreadId: string | null = null;

  constructor() {
    makeObservable(this);
    this.newThread();
  }

  @computed get activeThread(): AgentThread | null {
    return this.threads.find((t) => t.threadId === this.activeThreadId) ?? null;
  }

  /** Creates a thread if none is active. Idempotent. */
  @action ensureActiveThread(): AgentThread {
    return this.activeThread ?? this.newThread();
  }

  /**
   * Disposes the current active thread and spins up a fresh one,
   * making it active. Used for both navigation resets and the
   * user-triggered "new chat" action.
   */
  @action newThread(): AgentThread {
    const previous = this.activeThread;
    if (previous) {
      previous.dispose();
      this.threads = this.threads.filter((t) => t !== previous);
    }

    const thread = new AgentThread();
    this.threads = [...this.threads, thread];
    this.activeThreadId = thread.threadId;
    return thread;
  }

  @action disposeAll() {
    for (const thread of this.threads) {
      thread.dispose();
    }
    this.threads = [];
    this.activeThreadId = null;
  }
}
