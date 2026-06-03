import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import type { AgentContext } from "@/agent/types";
import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";

import { AiChatStore } from "./aiChatStore";

const AiChatStoreCtx = createRequiredContext<AiChatStore>("AiChatStoreContext");

interface AiChatStoreProviderProps {
  /** Page-owned factory that spawns the worker for this AI chat. */
  createWorker: () => Worker;
  /** Current page context, baked into each new thread's worker at init. */
  context: AgentContext;
  children: ReactNode;
}

export function AiChatStoreProvider({
  createWorker,
  context,
  children,
}: AiChatStoreProviderProps) {
  // Keep the latest context in a ref so the store (created once) can read
  // it lazily when spinning up a new thread, picking up navigation
  // changes without being recreated.
  const contextRef = useRef(context);
  contextRef.current = context;

  const [store] = useState(
    () =>
      new AiChatStore({
        createWorker,
        getContext: () => contextRef.current,
      }),
  );

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
