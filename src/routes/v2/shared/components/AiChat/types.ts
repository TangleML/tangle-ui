import type { IconName } from "@/components/ui/icon";

export interface ComponentRefData {
  name: string;
  yamlText: string;
}

/** An example question shown in the chat's empty state. */
export interface SuggestedPrompt {
  label: string;
  icon: IconName;
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
