import type { ReactNode } from "react";
import { useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

import { CanvasOverlayStore } from "./canvasOverlayStore";
import { EditorStore } from "./editorStore";
import { KeyboardStore } from "./keyboardStore";
import { NavigationStore } from "./navigationStore";

export class SharedUIStore {
  readonly editor: EditorStore;
  readonly keyboard: KeyboardStore;
  readonly navigation: NavigationStore;
  readonly canvasOverlay: CanvasOverlayStore;
  readonly windows: WindowStoreImpl;

  constructor() {
    this.editor = new EditorStore();
    this.keyboard = new KeyboardStore();
    this.navigation = new NavigationStore(this.editor);
    this.canvasOverlay = new CanvasOverlayStore();
    this.windows = new WindowStoreImpl();
  }
}

const SharedStoreCtx =
  createRequiredContext<SharedUIStore>("SharedStoreContext");

interface SharedStoreProviderProps {
  children: ReactNode;
  /**
   * Re-provide an existing store instead of creating one. Used to surface a
   * pipeline tab's live store to sibling UI (e.g. embedded chat chips) so they
   * navigate/focus the open canvas rather than an empty page-level store.
   */
  store?: SharedUIStore;
}

export function SharedStoreProvider({
  children,
  store,
}: SharedStoreProviderProps) {
  const [ownStore] = useState(() => store ?? new SharedUIStore());

  return (
    <SharedStoreCtx.Provider value={store ?? ownStore}>
      {children}
    </SharedStoreCtx.Provider>
  );
}

export function useSharedStores(): SharedUIStore {
  return useRequiredContext(SharedStoreCtx);
}
