import { createContext, type ReactNode, useContext } from "react";

export interface ChatEntityRevealValue {
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
