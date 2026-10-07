import type { ReactNode } from "react";
import { useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";

import { AutoSaveStore } from "./autoSaveStore";
import { ClipboardStore } from "./clipboardStore";
import { CollaborationStore } from "./collaborationStore";
import { PipelineFileStore } from "./pipelineFileStore";
import { UndoStore } from "./undoStore";

class EditorSessionStore {
  readonly undo: UndoStore;
  readonly autoSave: AutoSaveStore;
  readonly clipboard: ClipboardStore;
  readonly pipelineFile: PipelineFileStore;
  readonly collaboration: CollaborationStore;

  constructor() {
    this.undo = new UndoStore();
    this.pipelineFile = new PipelineFileStore();
    this.autoSave = new AutoSaveStore(this.undo, this.pipelineFile);
    this.clipboard = new ClipboardStore(this.undo);
    this.collaboration = new CollaborationStore();
  }
}

const EditorSessionCtx = createRequiredContext<EditorSessionStore>(
  "EditorSessionContext",
);

export function EditorSessionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new EditorSessionStore());
  return (
    <EditorSessionCtx.Provider value={store}>
      {children}
    </EditorSessionCtx.Provider>
  );
}

export function useEditorSession(): EditorSessionStore {
  return useRequiredContext(EditorSessionCtx);
}
