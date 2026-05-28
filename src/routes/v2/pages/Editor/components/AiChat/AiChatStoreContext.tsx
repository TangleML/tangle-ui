import type { ReactNode } from "react";
import { useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";

import { AiChatStore } from "./aiChatStore";

const AiChatStoreCtx = createRequiredContext<AiChatStore>("AiChatStoreContext");

export function AiChatStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new AiChatStore());

  return (
    <AiChatStoreCtx.Provider value={store}>{children}</AiChatStoreCtx.Provider>
  );
}

export function useAiChatStore(): AiChatStore {
  return useRequiredContext(AiChatStoreCtx);
}
