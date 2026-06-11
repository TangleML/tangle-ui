import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";

import { AiChatStore } from "./aiChatStore";

const AiChatStoreCtx = createRequiredContext<AiChatStore>("AiChatStoreContext");

export function AiChatStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new AiChatStore());

  // Ensure a thread exists on (re)mount and tear them all down on
  // unmount. The ensure-on-mount step matters under React StrictMode,
  // whose mount -> unmount -> mount cycle would otherwise leave the
  // store empty after the cleanup disposes the constructor-seeded thread.
  useEffect(() => {
    store.ensureActiveThread();
    return () => store.disposeAll();
  }, [store]);

  return (
    <AiChatStoreCtx.Provider value={store}>{children}</AiChatStoreCtx.Provider>
  );
}

export function useAiChatStore(): AiChatStore {
  return useRequiredContext(AiChatStoreCtx);
}
