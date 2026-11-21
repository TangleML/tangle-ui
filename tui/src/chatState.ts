import type {
  AgentActivity,
  ChatMessage,
  SubagentInfo,
} from "@tangent/shared/contracts.ts";

export const PRIME_TITLE = "Prime";

export interface ConversationState {
  id: string;
  title: string;
  messages: ChatMessage[];
  activity: AgentActivity | null;
  /** Whether an agent run is live in this thread (streaming or mid tool/think). */
  busy: boolean;
  /** Whether this thread's history has been loaded (join seed or subscribe). */
  hydrated: boolean;
}

export interface ChatState {
  sessionId: string;
  primaryConversationId: string | null;
  subagents: SubagentInfo[];
  conversations: Record<string, ConversationState>;
  /** Conversation ids in tab order: the primary thread first, then sub-agents. */
  order: string[];
  error: string | null;
}

export function createChatState(sessionId: string): ChatState {
  return {
    sessionId,
    primaryConversationId: null,
    subagents: [],
    conversations: {},
    order: [],
    error: null,
  };
}

function emptyConversation(id: string): ConversationState {
  return {
    id,
    title: id,
    messages: [],
    activity: null,
    busy: false,
    hydrated: false,
  };
}

function conversationOf(state: ChatState, id: string): ConversationState {
  return state.conversations[id] ?? emptyConversation(id);
}

function replaceConversation(
  state: ChatState,
  conversation: ConversationState,
): ChatState {
  const order = state.order.includes(conversation.id)
    ? state.order
    : [...state.order, conversation.id];
  return {
    ...state,
    order,
    conversations: {
      ...state.conversations,
      [conversation.id]: conversation,
    },
  };
}

function sortedBySeq(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => a.seq - b.seq);
}

function upsertMessage(
  messages: ChatMessage[],
  message: ChatMessage,
): ChatMessage[] {
  const index = messages.findIndex((existing) => existing.id === message.id);
  if (index === -1) return [...messages, message];
  const next = [...messages];
  next[index] = message;
  return next;
}

function conversationIdOfMessage(
  state: ChatState,
  messageId: string,
): string | undefined {
  for (const conversation of Object.values(state.conversations)) {
    if (conversation.messages.some((message) => message.id === messageId)) {
      return conversation.id;
    }
  }
  return undefined;
}

export function withHistory(
  state: ChatState,
  messages: ChatMessage[],
): ChatState {
  let next = state;
  const byConversation = new Map<string, ChatMessage[]>();
  for (const message of messages) {
    const bucket = byConversation.get(message.conversationId) ?? [];
    bucket.push(message);
    byConversation.set(message.conversationId, bucket);
  }
  for (const [id, bucket] of byConversation) {
    next = replaceConversation(next, {
      ...conversationOf(next, id),
      id,
      messages: sortedBySeq(bucket),
      hydrated: true,
    });
  }
  return next;
}

export function withConversationHistory(
  state: ChatState,
  conversationId: string,
  messages: ChatMessage[],
): ChatState {
  return replaceConversation(state, {
    ...conversationOf(state, conversationId),
    id: conversationId,
    messages: sortedBySeq(messages),
    hydrated: true,
  });
}

function titleFor(
  conversationId: string,
  primaryConversationId: string,
  subagents: SubagentInfo[],
): string {
  if (conversationId === primaryConversationId) return PRIME_TITLE;
  const match = subagents.find(
    (subagent) => subagent.conversationId === conversationId,
  );
  return match?.name ?? conversationId;
}

export function withRoster(
  state: ChatState,
  primaryConversationId: string,
  subagents: SubagentInfo[],
): ChatState {
  const ids = [
    primaryConversationId,
    ...subagents.map((subagent) => subagent.conversationId),
  ];
  const conversations = { ...state.conversations };
  for (const id of ids) {
    const existing = conversations[id] ?? emptyConversation(id);
    conversations[id] = {
      ...existing,
      title: titleFor(id, primaryConversationId, subagents),
    };
  }
  const order = [
    primaryConversationId,
    ...subagents
      .map((subagent) => subagent.conversationId)
      .filter((id) => id !== primaryConversationId),
  ];
  return { ...state, primaryConversationId, subagents, conversations, order };
}

export function withSubagentUpdate(
  state: ChatState,
  subagent: SubagentInfo,
): ChatState {
  const subagents = upsertSubagent(state.subagents, subagent);
  if (!state.primaryConversationId) {
    return { ...state, subagents };
  }
  return withRoster(state, state.primaryConversationId, subagents);
}

function upsertSubagent(
  subagents: SubagentInfo[],
  subagent: SubagentInfo,
): SubagentInfo[] {
  const index = subagents.findIndex((existing) => existing.id === subagent.id);
  if (index === -1) return [...subagents, subagent];
  const next = [...subagents];
  next[index] = subagent;
  return next;
}

export function withHumanMessage(
  state: ChatState,
  message: ChatMessage,
): ChatState {
  const conversation = conversationOf(state, message.conversationId);
  return replaceConversation(state, {
    ...conversation,
    id: message.conversationId,
    messages: sortedBySeq(upsertMessage(conversation.messages, message)),
  });
}

export function withAgentStart(
  state: ChatState,
  message: ChatMessage,
): ChatState {
  const conversation = conversationOf(state, message.conversationId);
  return replaceConversation(state, {
    ...conversation,
    id: message.conversationId,
    messages: upsertMessage(conversation.messages, message),
    activity: null,
    busy: true,
  });
}

function appendToMessage(
  state: ChatState,
  messageId: string,
  mutate: (message: ChatMessage) => ChatMessage,
): ChatState {
  const conversationId = conversationIdOfMessage(state, messageId);
  if (!conversationId) return state;
  const conversation = conversationOf(state, conversationId);
  const messages = conversation.messages.map((message) =>
    message.id === messageId ? mutate(message) : message,
  );
  return replaceConversation(state, { ...conversation, messages });
}

export function withAgentDelta(
  state: ChatState,
  messageId: string,
  delta: string,
): ChatState {
  return appendToMessage(state, messageId, (message) => ({
    ...message,
    content: message.content + delta,
  }));
}

export function withAgentThinking(
  state: ChatState,
  messageId: string,
  delta: string,
): ChatState {
  return appendToMessage(state, messageId, (message) => ({
    ...message,
    thinking: (message.thinking ?? "") + delta,
  }));
}

export function withAgentEnd(
  state: ChatState,
  message: ChatMessage,
): ChatState {
  const conversation = conversationOf(state, message.conversationId);
  return replaceConversation(state, {
    ...conversation,
    id: message.conversationId,
    messages: upsertMessage(conversation.messages, message),
    activity: null,
    busy: false,
  });
}

export function withAgentError(
  state: ChatState,
  messageId: string | undefined,
  message: string,
): ChatState {
  let next = state;
  if (messageId) {
    const conversationId = conversationIdOfMessage(state, messageId);
    next = appendToMessage(next, messageId, (existing) => ({
      ...existing,
      endsRun: true,
    }));
    if (conversationId) {
      next = replaceConversation(next, {
        ...conversationOf(next, conversationId),
        activity: null,
        busy: false,
      });
    }
  }
  return { ...next, error: message };
}

export function withActivity(
  state: ChatState,
  conversationId: string,
  activity: AgentActivity | null,
): ChatState {
  const conversation = conversationOf(state, conversationId);
  return replaceConversation(state, {
    ...conversation,
    id: conversationId,
    activity,
    busy: activity !== null ? true : conversation.busy,
  });
}

export function withClearedError(state: ChatState): ChatState {
  return state.error === null ? state : { ...state, error: null };
}

export interface WorkingAgent {
  id: string;
  title: string;
  label: string;
}

function isConversationBusy(conversation: ConversationState): boolean {
  return conversation.busy || conversation.activity !== null;
}

/** The threads doing something right now, in tab order, for the status line. */
export function workingConversations(state: ChatState): WorkingAgent[] {
  return state.order.flatMap((id) => {
    const conversation = state.conversations[id];
    if (!conversation || !isConversationBusy(conversation)) return [];
    return [
      {
        id,
        title: conversation.title,
        label: conversation.activity?.label ?? "Working…",
      },
    ];
  });
}

export type TabTone = "error" | "done";

export interface TabInfo {
  title: string;
  busy: boolean;
  tone?: TabTone;
}

function subagentToneOf(status: SubagentInfo["status"]): TabTone | undefined {
  if (status === "error" || status === "killed") return "error";
  if (status === "completed") return "done";
  return undefined;
}

/** Per-tab title, busy flag, and terminal tone (error/done) for sub-agents. */
export function tabInfos(state: ChatState): TabInfo[] {
  const statusByConversation = new Map(
    state.subagents.map((subagent) => [
      subagent.conversationId,
      subagent.status,
    ]),
  );
  return state.order.map((id) => {
    const conversation = state.conversations[id];
    const status = statusByConversation.get(id);
    const tone = status ? subagentToneOf(status) : undefined;
    return {
      title: conversation?.title ?? id,
      busy: conversation ? isConversationBusy(conversation) : false,
      ...(tone ? { tone } : {}),
    };
  });
}
