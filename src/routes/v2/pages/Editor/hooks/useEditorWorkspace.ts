import type { ComponentSpec } from "@/models/componentSpec";
import { useShortcutListener } from "@/routes/v2/shared/shortcuts/useShortcutListener";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import { useComponentSearchWindow } from "./useComponentSearchWindow";
import { useEditorEscapeShortcut } from "./useEditorEscapeShortcut";
import { useHistoryWindow } from "./useHistoryWindow";
import { useLinkedWindowCleanup } from "./useLinkedWindowCleanup";
import type { LoadedSpec } from "./useLoadSpec";
import { usePipelineDetailsWindow } from "./usePipelineDetailsWindow";
import { useRecentRunsWindow } from "./useRecentRunsWindow";
import { useRunsAndSubmissionWindow } from "./useRunsAndSubmissionWindow";
import { useSelectionWindowSync } from "./useSelectionWindowSync";
import { useSpecLifecycle } from "./useSpecLifecycle";
import { useUndoRedoKeyboard } from "./useUndoRedoKeyboard";

export interface EditorDocument {
  spec: ComponentSpec;
  file?: PipelineFile;
  saveState?: LoadedSpec["saveState"];
  undoManager?: LoadedSpec["undoManager"];
}

export function useEditorWorkspace(
  { spec, file, saveState, undoManager }: EditorDocument,
  {
    isActive = true,
    selection,
    renderSubmitter = false,
  }: {
    isActive?: boolean;
    selection?: Parameters<typeof useSelectionWindowSync>[0];
    renderSubmitter?: boolean;
  } = {},
) {
  useSpecLifecycle(spec, file, saveState, undoManager);
  useSelectionWindowSync(selection);
  useLinkedWindowCleanup();
  usePipelineDetailsWindow({ ownerId: file?.ownerId });
  useHistoryWindow();
  useRecentRunsWindow();
  useRunsAndSubmissionWindow({ renderSubmitter });
  useUndoRedoKeyboard();
  useShortcutListener(isActive);
  useEditorEscapeShortcut();
  useComponentSearchWindow();
}
