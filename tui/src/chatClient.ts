import type {
  AgentActivityPayload,
  AgentDeltaPayload,
  AgentEndPayload,
  AgentErrorPayload,
  AgentStartPayload,
  AgentThinkingPayload,
  ChatAuthor,
  ChatMessage,
  ConversationHistoryPayload,
  SubagentRosterPayload,
  SubagentUpdatePayload,
} from "@tangent/shared/contracts.ts";
import { humanAuthor, SocketEvents } from "@tangent/shared/contracts.ts";
import { io, type Socket } from "socket.io-client";

import {
  type ChatState,
  createChatState,
  withActivity,
  withAgentDelta,
  withAgentEnd,
  withAgentError,
  withAgentStart,
  withAgentThinking,
  withConversationHistory,
  withHistory,
  withHumanMessage,
  withRoster,
  withSubagentUpdate,
} from "./chatState.ts";

export interface ChatClientOptions {
  shellUrl: string;
  sessionId: string;
  cookie?: string;
  authToken?: string;
  userEmail?: string;
}

export type ChatStateListener = (state: ChatState) => void;

interface SocketTarget {
  socketUrl: string;
  socketPath: string;
}

/**
 * Socket.IO treats the URL as an origin and derives the endpoint from a
 * separate path, so a mounted-prefix Shell must move its prefix into the path.
 */
function socketTargetOf(shellUrl: string): SocketTarget {
  const url = new URL(shellUrl);
  const prefix = url.pathname.replace(/\/+$/, "");
  return { socketUrl: url.origin, socketPath: `${prefix}/socket.io` };
}

/**
 * The client half of the Shell chat protocol: joins a session, keeps a
 * {@link ChatState} in sync with the streamed agent events, and sends human
 * messages. Identity is carried on the handshake, never the payload (the server
 * attributes messages from the connection). The cookie admits the socket
 * through the SSO proxy; `auth.token` names the sender. Without it the server
 * attributes messages to its default user, who owns none of this user's local
 * hosts, so Prime would see no remote tools.
 */
export class ChatClient {
  private readonly socket: Socket;
  private readonly sessionId: string;
  private readonly author: ChatAuthor;
  private state: ChatState;
  private readonly listeners = new Set<ChatStateListener>();

  constructor(options: ChatClientOptions) {
    this.sessionId = options.sessionId;
    this.author = humanAuthor({
      email: options.userEmail ?? "",
      first_name: "",
      last_name: "",
    });
    this.state = createChatState(options.sessionId);
    const { socketUrl, socketPath } = socketTargetOf(options.shellUrl);
    this.socket = io(socketUrl, {
      path: socketPath,
      transports: ["websocket"],
      ...(options.cookie ? { extraHeaders: { Cookie: options.cookie } } : {}),
      ...(options.authToken ? { auth: { token: options.authToken } } : {}),
    });
    this.wire();
  }

  getState(): ChatState {
    return this.state;
  }

  subscribe(listener: ChatStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  send(content: string, conversationId?: string): void {
    const trimmed = content.trim();
    if (!trimmed) return;
    const targetConversationId =
      conversationId ?? this.state.primaryConversationId;
    if (targetConversationId) {
      this.setState(
        withHumanMessage(
          this.state,
          this.optimisticMessage(targetConversationId, trimmed),
        ),
      );
    }
    this.socket.emit(SocketEvents.ChatMessage, {
      sessionId: this.sessionId,
      content: trimmed,
      ...(conversationId ? { conversationId } : {}),
    });
  }

  private optimisticMessage(
    conversationId: string,
    content: string,
  ): ChatMessage {
    const existing = this.state.conversations[conversationId]?.messages ?? [];
    const maxSeq = existing.reduce(
      (max, message) => Math.max(max, message.seq),
      0,
    );
    return {
      id: crypto.randomUUID(),
      sessionId: this.sessionId,
      conversationId,
      seq: maxSeq + 1,
      author: this.author,
      mentions: [],
      source: { kind: "human" },
      content,
      createdAt: new Date().toISOString(),
    };
  }

  subscribeConversation(conversationId: string): void {
    this.socket.emit(SocketEvents.ConversationSubscribe, {
      sessionId: this.sessionId,
      conversationId,
    });
  }

  dispose(): void {
    this.listeners.clear();
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }

  private setState(next: ChatState): void {
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }

  private wire(): void {
    this.socket.on("connect", () => {
      this.socket.emit(SocketEvents.ChatJoin, { sessionId: this.sessionId });
    });
    this.socket.on("connect_error", (error: Error) => {
      this.setState(withAgentError(this.state, undefined, error.message));
    });
    this.socket.on("error", (payload: { message?: string }) => {
      this.setState(
        withAgentError(
          this.state,
          undefined,
          payload?.message ?? "Chat error.",
        ),
      );
    });
    this.wireHistory();
    this.wireRoster();
    this.wireStream();
  }

  private wireHistory(): void {
    this.socket.on(SocketEvents.ChatHistory, (messages: ChatMessage[]) => {
      this.setState(withHistory(this.state, messages));
    });
    this.socket.on(
      SocketEvents.ConversationHistory,
      (payload: ConversationHistoryPayload) => {
        this.setState(
          withConversationHistory(
            this.state,
            payload.conversationId,
            payload.messages,
          ),
        );
      },
    );
  }

  private wireRoster(): void {
    this.socket.on(
      SocketEvents.SubagentRoster,
      (payload: SubagentRosterPayload) => {
        this.setState(
          withRoster(
            this.state,
            payload.primaryConversationId,
            payload.subagents,
          ),
        );
      },
    );
    this.socket.on(
      SocketEvents.SubagentUpdate,
      (payload: SubagentUpdatePayload) => {
        this.setState(withSubagentUpdate(this.state, payload.subagent));
      },
    );
  }

  private wireStream(): void {
    this.socket.on(SocketEvents.AgentStart, (payload: AgentStartPayload) => {
      this.setState(withAgentStart(this.state, payload.message));
    });
    this.socket.on(SocketEvents.AgentDelta, (payload: AgentDeltaPayload) => {
      this.setState(
        withAgentDelta(this.state, payload.messageId, payload.delta),
      );
    });
    this.socket.on(
      SocketEvents.AgentThinking,
      (payload: AgentThinkingPayload) => {
        this.setState(
          withAgentThinking(this.state, payload.messageId, payload.delta),
        );
      },
    );
    this.socket.on(SocketEvents.AgentEnd, (payload: AgentEndPayload) => {
      this.setState(withAgentEnd(this.state, payload.message));
    });
    this.socket.on(SocketEvents.AgentError, (payload: AgentErrorPayload) => {
      this.setState(
        withAgentError(this.state, payload.messageId, payload.message),
      );
    });
    this.socket.on(
      SocketEvents.AgentActivity,
      (payload: AgentActivityPayload) => {
        this.setState(
          withActivity(this.state, payload.conversationId, payload.activity),
        );
      },
    );
  }
}
