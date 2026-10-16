import type { ReactNode } from "react";
import { useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import useToastNotification from "@/hooks/useToastNotification";

import { AutoSaveStore } from "./autoSaveStore";
import { ClipboardStore } from "./clipboardStore";
import { PipelineFileStore } from "./pipelineFileStore";
import { UndoStore } from "./undoStore";

class EditorSessionStore {
  readonly undo: UndoStore;
  readonly autoSave: AutoSaveStore;
  readonly clipboard: ClipboardStore;
  readonly pipelineFile: PipelineFileStore;

  constructor(onSaveError: (error: Error) => void) {
    this.undo = new UndoStore();
    this.pipelineFile = new PipelineFileStore();
    this.autoSave = new AutoSaveStore(this.undo, onSaveError);
    this.clipboard = new ClipboardStore(this.undo);
  }
}

const EditorSessionCtx = createRequiredContext<EditorSessionStore>(
  "EditorSessionContext",
);

export function EditorSessionProvider({ children }: { children: ReactNode }) {
  const notify = useToastNotification();
  const [store] = useState(
    () =>
      new EditorSessionStore((error) => {
        notify(`Failed to save pipeline: ${error.message}`, "error");
      }),
  );
  return (
    <EditorSessionCtx.Provider value={store}>
      {children}
    </EditorSessionCtx.Provider>
  );
}

export function useEditorSession(): EditorSessionStore {
  return useRequiredContext(EditorSessionCtx);
}
