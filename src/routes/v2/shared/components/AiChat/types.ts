export interface ComponentRefData {
  name: string;
  yamlText: string;
}

interface BaseChatMessage {
  id: string;
  content: string;
  componentReferences?: Record<string, ComponentRefData>;
}

interface UserChatMessage extends BaseChatMessage {
  role: "user";
}

interface AssistantChatMessage extends BaseChatMessage {
  role: "assistant";
  prompt: string;
}

export type ChatMessage = UserChatMessage | AssistantChatMessage;
