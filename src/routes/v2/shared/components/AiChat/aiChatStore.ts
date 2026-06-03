import { action, computed, makeObservable, observable } from "mobx";

import type { AgentContext } from "@/agent/types";

import { AgentThread } from "./agentThread";

/**
 * Config the page supplies so the store can build page-specific threads:
 * `createWorker` spawns the Editor vs Run View worker, and `getContext`
 * is resolved freshly on every {@link AiChatStore.newThread} call so a
 * thread created after navigation captures the current run context.
 */
export interface AiChatStoreConfig {
  createWorker: () => Worker;
  getContext: () => AgentContext;
}

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
  /**
   * Prompt queued by a consumer (e.g. an external "ask the assistant"
   * button) to be sent on the active thread. {@link AiChatContent} owns
   * the tool bridge, so it observes this and dispatches the send.
   */
  @observable accessor pendingPrompt: string | null = null;

  constructor(private readonly config: AiChatStoreConfig) {
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

    const thread = new AgentThread({
      createWorker: this.config.createWorker,
      context: this.config.getContext(),
    });
    this.threads = [...this.threads, thread];
    this.activeThreadId = thread.threadId;
    return thread;
  }

  /**
   * Starts a fresh thread and queues a prompt to be sent on it. The
   * dispatch happens in {@link AiChatContent}, which holds the tool
   * bridge required to fulfil tool calls.
   */
  @action startThreadWithPrompt(prompt: string): AgentThread {
    const thread = this.newThread();
    this.pendingPrompt = prompt;
    return thread;
  }

  /** Returns and clears the queued prompt, guarding against double-sends. */
  @action consumePendingPrompt(): string | null {
    const prompt = this.pendingPrompt;
    this.pendingPrompt = null;
    return prompt;
  }

  @action disposeAll() {
    for (const thread of this.threads) {
      thread.dispose();
    }
    this.threads = [];
    this.activeThreadId = null;
    this.pendingPrompt = null;
  }
}
