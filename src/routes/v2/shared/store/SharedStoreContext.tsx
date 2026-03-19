import type { ReactNode } from "react";
import { useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";

import { EditorStore } from "./editorStore";
import { KeyboardStore } from "./keyboardStore";
import { NavigationStore } from "./navigationStore";

class SharedUIStore {
  readonly editor: EditorStore;
  readonly keyboard: KeyboardStore;
  readonly navigation: NavigationStore;

  constructor() {
    this.editor = new EditorStore();
    this.keyboard = new KeyboardStore();
    this.navigation = new NavigationStore(this.editor);
  }
}

const SharedStoreCtx =
  createRequiredContext<SharedUIStore>("SharedStoreContext");

export function SharedStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new SharedUIStore());

  return (
    <SharedStoreCtx.Provider value={store}>{children}</SharedStoreCtx.Provider>
  );
}

export function useSharedStores(): SharedUIStore {
  return useRequiredContext(SharedStoreCtx);
}
