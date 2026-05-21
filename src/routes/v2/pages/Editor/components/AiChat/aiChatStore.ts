import { action, makeObservable, observable, runInAction } from "mobx";

import type { RecentPipelineRun } from "@/agent/session";
import type { ComponentSpec } from "@/models/componentSpec";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import type { PipelineRun } from "@/types/pipelineRun";
import { getErrorMessage } from "@/utils/string";

import { getAgentClient } from "./agentClient";
import type {
  AiChatRequest,
  ChatMessage,
  Command,
  SseCommandEvent,
  SseDoneEvent,
  SseStatusEvent,
} from "./aiChat.types";
import type { AiSpec } from "./serializeSpecForAi";

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function* parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
) {
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const lines = part.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data = line.slice(6);
      }
      if (data) yield { event, data };
    }
  }
}

interface SendMessageOptions {
  currentSpec: AiSpec | null;
  selectedEntityId: string | null;
  recentRuns: PipelineRun[];
  processCommand: (command: Command) => void;
  onError: (message: string) => void;
}

interface SendMessageViaWorkerOptions {
  selectedEntityId: string | null;
  recentRuns: RecentPipelineRun[];
  getSpec: () => ComponentSpec | null;
  undo: UndoGroupable;
  onError: (message: string) => void;
}

const WORKER_RUNTIME_FLAG = "agent.runtime";

export function isWorkerRuntimeEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(WORKER_RUNTIME_FLAG) === "worker";
}

/**
 * Stores AI chat state (messages, thread, streaming status) outside the
 * React component tree so it survives window minimize / hide / unmount.
 */
export class AiChatStore {
  @observable.shallow accessor messages: ChatMessage[] = [];
  @observable accessor threadId: string | undefined = undefined;
  @observable accessor thinkingText: string | null = null;
  @observable accessor isPending = false;

  private abortController: AbortController | null = null;
  private pendingCommands: Command[] = [];

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
    this.pendingCommands = [];
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

    this.pendingCommands = [];
    const controller = new AbortController();
    this.abortController = controller;

    try {
      const body: AiChatRequest = {
        message: prompt,
        ...(options.currentSpec && { currentSpec: options.currentSpec }),
        ...(options.selectedEntityId && {
          selectedEntityId: options.selectedEntityId,
        }),
        ...(this.threadId && { threadId: this.threadId }),
        ...(options.recentRuns.length > 0 && {
          recentRuns: options.recentRuns,
        }),
      };

      const response = await fetch("http://localhost:4100/api/agent/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("AI request failed");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();

      for await (const frame of parseSseStream(reader)) {
        switch (frame.event) {
          case "status": {
            const status = JSON.parse(frame.data) as SseStatusEvent;
            runInAction(() => {
              this.thinkingText = status.text;
            });
            break;
          }
          case "command": {
            const cmd = JSON.parse(frame.data) as SseCommandEvent;
            this.pendingCommands.push(cmd);
            options.processCommand(cmd);
            break;
          }
          case "done": {
            const done = JSON.parse(frame.data) as SseDoneEvent;
            const commands = this.pendingCommands;
            this.pendingCommands = [];
            runInAction(() => {
              this.thinkingText = null;
              this.messages = [
                ...this.messages,
                {
                  id: generateMessageId(),
                  role: "assistant",
                  content: done.answer,
                  ...(commands.length > 0 && { commands }),
                  ...(done.componentReferences && {
                    componentReferences: done.componentReferences,
                  }),
                },
              ];
              this.threadId = done.threadId;
            });
            break;
          }
          case "error": {
            const { error } = JSON.parse(frame.data) as { error: string };
            throw new Error(error);
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        options.onError("AI request failed: " + getErrorMessage(error));
      }
    } finally {
      this.abortController = null;
      this.pendingCommands = [];
      runInAction(() => {
        this.isPending = false;
        this.thinkingText = null;
      });
    }
  }

  /**
   * Send a message using the in-browser agent worker. Tools mutate the
   * live MobX spec directly via the tool bridge, so the assistant's
   * changes are visible immediately and no command-replay step is
   * needed. Mirrors `sendMessage` for thread, status, and message
   * accounting.
   */
  async sendMessageViaWorker(
    prompt: string,
    options: SendMessageViaWorkerOptions,
  ) {
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
          getSpec: options.getSpec,
          undo: options.undo,
          onStatus: (status) => {
            runInAction(() => {
              this.thinkingText = status.text;
            });
          },
        },
        {
          message: prompt,
          ...(this.threadId && { threadId: this.threadId }),
          ...(options.selectedEntityId && {
            selectedEntityId: options.selectedEntityId,
          }),
          ...(options.recentRuns.length > 0 && {
            recentRuns: options.recentRuns,
          }),
        },
      );

      runInAction(() => {
        this.thinkingText = null;
        this.threadId = response.threadId;
        const hasRefs = Object.keys(response.componentReferences).length > 0;
        this.messages = [
          ...this.messages,
          {
            id: generateMessageId(),
            role: "assistant",
            content: response.answer,
            ...(hasRefs && {
              componentReferences: response.componentReferences,
            }),
          },
        ];
      });
    } catch (error) {
      options.onError("AI request failed: " + getErrorMessage(error));
    } finally {
      runInAction(() => {
        this.isPending = false;
        this.thinkingText = null;
      });
    }
  }
}
