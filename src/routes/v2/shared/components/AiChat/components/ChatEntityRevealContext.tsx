import { createContext, type ReactNode, useContext } from "react";

export interface ChatEntityRevealValue {
  /**
   * Reveal an `entity://` chip target: open/activate the pipeline tab that owns
   * it, then focus the entity. Provided by the Tangent project workspace; absent
   * in the standalone editor (where chips navigate the single live spec).
   */
  revealEntity: (entityId: string, label: string) => void;
}

const ChatEntityRevealContext = createContext<ChatEntityRevealValue | null>(
  null,
);

export function ChatEntityRevealProvider({
  value,
  children,
}: {
  value: ChatEntityRevealValue;
  children: ReactNode;
}) {
  return (
    <ChatEntityRevealContext.Provider value={value}>
      {children}
    </ChatEntityRevealContext.Provider>
  );
}

export function useOptionalChatEntityReveal(): ChatEntityRevealValue | null {
  return useContext(ChatEntityRevealContext);
}
