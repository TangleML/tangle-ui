export interface ComponentRefData {
  name: string;
  yamlText: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  componentReferences?: Record<string, ComponentRefData>;
}

/**
 * Query keys for React Query.
 */
export const AiAssistantTokenQueryKeys = {
  Token: () => ["ai-assistant-token"] as const,
} as const;
