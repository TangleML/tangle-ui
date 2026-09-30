import { nanoid } from "nanoid";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";

import { AutoSaveStore } from "./autoSaveStore";
import { ClipboardStore } from "./clipboardStore";
import { PipelineFileStore } from "./pipelineFileStore";
import { UndoStore } from "./undoStore";

class EditorSessionStore {
  readonly id = nanoid();
  readonly undo: UndoStore;
  readonly autoSave: AutoSaveStore;
  readonly clipboard: ClipboardStore;
  readonly pipelineFile: PipelineFileStore;

  constructor(storage: PipelineStorageService) {
    this.undo = new UndoStore();
    this.pipelineFile = new PipelineFileStore();
    this.autoSave = new AutoSaveStore(this.undo, this.pipelineFile, storage);
    this.clipboard = new ClipboardStore(this.undo);
  }
}

const EditorSessionCtx = createRequiredContext<EditorSessionStore>(
  "EditorSessionContext",
);

export function EditorSessionProvider({ children }: { children: ReactNode }) {
  const storage = usePipelineStorage();
  const [store] = useState(() => new EditorSessionStore(storage));
  return (
    <EditorSessionCtx.Provider value={store}>
      {children}
    </EditorSessionCtx.Provider>
  );
}

export function useEditorSession(): EditorSessionStore {
  return useRequiredContext(EditorSessionCtx);
}
