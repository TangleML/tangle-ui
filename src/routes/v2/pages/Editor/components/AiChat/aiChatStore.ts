import { action, makeObservable, observable, runInAction } from "mobx";

import { getErrorMessage } from "@/utils/string";

import { getAgentClient } from "./agentClient";
import type { ChatMessage } from "./aiChat.types";

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface SendMessageOptions {
  onError: (message: string) => void;
}

/**
 * Stores AI chat state (messages, thread, pending status) outside the
 * React component tree so it survives window minimize / hide / unmount.
 */
export class AiChatStore {
  @observable.shallow accessor messages: ChatMessage[] = [];
  @observable accessor threadId: string | undefined = undefined;
  @observable accessor thinkingText: string | null = null;
  @observable accessor isPending = false;

  private abortController: AbortController | null = null;

  constructor() {
    makeObservable(this);
  }

  @action resetState() {
    this.messages = [];
    this.threadId = undefined;
    this.thinkingText = null;
    this.isPending = false;
    this.abortController?.abort();
    this.abortController = null;
  }

  abort() {
    this.abortController?.abort();
  }

  async sendMessage(prompt: string, options: SendMessageOptions) {
    runInAction(() => {
      this.messages = [
        ...this.messages,
        { id: generateMessageId(), role: "user", content: prompt },
      ];
      this.isPending = true;
      this.thinkingText = null;
    });

    try {
      const client = getAgentClient();
      const response = await client.ask(
        {
          onStatus: (status) => {
            runInAction(() => {
              this.thinkingText = status.text;
            });
          },
        },
        {
          message: prompt,
          ...(this.threadId && { threadId: this.threadId }),
        },
      );

      runInAction(() => {
        this.thinkingText = null;
        this.threadId = response.threadId;
        this.messages = [
          ...this.messages,
          {
            id: generateMessageId(),
            role: "assistant",
            content: response.answer,
          },
        ];
      });
    } catch (error) {
      options.onError(`AI request failed: ${getErrorMessage(error)}`);
    } finally {
      this.abortController = null;
      runInAction(() => {
        this.isPending = false;
        this.thinkingText = null;
      });
    }
  }
}
