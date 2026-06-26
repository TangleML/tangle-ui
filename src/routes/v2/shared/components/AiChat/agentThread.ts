import { action, makeObservable, observable, runInAction } from "mobx";

import type { RecentPipelineRun } from "@/agent/session";
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import type { AgentContext } from "@/agent/types";
import type { AiProviderConfig } from "@/types/aiProvider";
import { getErrorMessage } from "@/utils/string";

import { AgentClient } from "./agentClient";
import type { ChatMessage } from "./types";

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateThreadId(): string {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatAssistantError(error: unknown): string {
  const message = getErrorMessage(error);
  if (isProviderConversationStateError(message)) {
    return "I ran into a model conversation-state error while processing that request. Please try again in this chat, or start a new chat if it keeps happening.";
  }

  return `I couldn't complete that request: ${message}`;
}

function isProviderConversationStateError(message: string): boolean {
  return (
    /\brs_[a-zA-Z0-9]+\b/.test(message) ||
    /required ['"]reasoning['"] item/i.test(message) ||
    /Item with id .* not found/i.test(message)
  );
}

interface SendMessageOptions {
  bridge: ToolBridgeApi;
  aiConfig: AiProviderConfig;
  recentRuns?: RecentPipelineRun[];
}

/**
 * Per-thread worker configuration supplied by the page that owns the AI
 * chat. `createWorker` spawns the page-specific worker (Editor vs Run
 * View) and `context` is baked into that worker at init time.
 */
export interface AgentThreadConfig {
  createWorker: () => Worker;
  context: AgentContext;
}

/**
 * A single AI conversation: one Web Worker (agent + in-memory session)
 * plus the chat state that survives the React component tree (window
 * minimize / hide / unmount). Disposing a thread terminates its worker
 * and discards the conversation entirely.
 */
export class AgentThread {
  readonly threadId: string;

  @observable.shallow accessor messages: ChatMessage[] = [];
  @observable accessor thinkingText: string | null = null;
  @observable accessor isPending = false;

  private readonly client: AgentClient;
  private abortController: AbortController | null = null;

  constructor(config: AgentThreadConfig, threadId?: string) {
    makeObservable(this);
    this.threadId = threadId ?? generateThreadId();
    this.client = new AgentClient(
      this.threadId,
      config.createWorker,
      config.context,
    );
  }

  abort() {
    this.abortController?.abort();
  }

  async sendMessage(prompt: string, options: SendMessageOptions) {
    const abortController = new AbortController();
    this.abortController = abortController;

    runInAction(() => {
      this.messages = [
        ...this.messages,
        { id: generateMessageId(), role: "user", content: prompt },
      ];
      this.isPending = true;
      this.thinkingText = null;
    });

    try {
      const response = await this.client.ask(
        {
          bridge: options.bridge,
          onStatus: (status) => {
            runInAction(() => {
              this.thinkingText = status.text;
            });
          },
        },
        {
          message: prompt,
          aiConfig: options.aiConfig,
          ...(options.recentRuns && { recentRuns: options.recentRuns }),
        },
        abortController.signal,
      );

      runInAction(() => {
        this.thinkingText = null;
        const componentReferences = response.componentReferences;
        this.messages = [
          ...this.messages,
          {
            id: generateMessageId(),
            role: "assistant",
            content: response.answer,
            ...(Object.keys(componentReferences).length > 0
              ? { componentReferences }
              : {}),
          },
        ];
      });
    } catch (error) {
      runInAction(() => {
        this.thinkingText = null;
        this.messages = [
          ...this.messages,
          {
            id: generateMessageId(),
            role: "assistant",
            content: formatAssistantError(error),
          },
        ];
      });
    } finally {
      this.abortController = null;
      runInAction(() => {
        this.isPending = false;
        this.thinkingText = null;
      });
    }
  }

  @action dispose() {
    this.abortController?.abort();
    this.abortController = null;
    this.client.terminate();
  }

  // future: persist() — snapshot/restore a thread across reloads. Out of
  // scope for now.
}
