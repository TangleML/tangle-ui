import { useNavigate } from "@tanstack/react-router";
import { generate } from "random-words";
import { type RefObject, useEffect, useRef, useState } from "react";

import { useNewPipelineDraft } from "@/hooks/useNewPipelineDraft";
import useToastNotification from "@/hooks/useToastNotification";
import { serializeComponentSpec } from "@/models/componentSpec";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { APP_ROUTES } from "@/routes/router";
import { usePipelineRename } from "@/routes/v2/pages/Editor/hooks/usePipelineRename";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { CTRL } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { getRemotePipelineDeletionError } from "@/services/pipelineStorage/remotePipelineDeletion";

import { exportCurrentPipeline, savePipelineAs } from "./fileMenu.actions";

interface FileMenuState {
  importTriggerRef: RefObject<HTMLButtonElement | null>;
  saveAsDialogOpen: boolean;
  setSaveAsDialogOpen: (open: boolean) => void;
  renameDialogOpen: boolean;
  setRenameDialogOpen: (open: boolean) => void;
  renamePipeline: (name: string) => void;
  getRenameInitialName: () => string;
  setImportOpen: (open: boolean) => void;
  handleSave: () => void;
  handleNewPipeline: () => void;
  handleSavePipelineAs: (name: string) => void;
  handleExport: () => void;
  getSaveAsInitialName: () => string;
}

export function useFileMenuState(): FileMenuState {
  const { keyboard, navigation } = useSharedStores();
  const { autoSave, pipelineFile: pipelineFileStore } = useEditorSession();
  const renamePipeline = usePipelineRename();
  const storage = usePipelineStorage();
  const newDraft = useNewPipelineDraft();
  const tourMode = useTourMode();
  const navigate = useNavigate();
  const notify = useToastNotification();
  const [importOpen, setImportOpen] = useState(false);
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const importTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (tourMode) return;
    return keyboard.registerShortcut({
      id: "open-pipeline",
      keys: [CTRL, "O"],
      label: "Open Pipeline",
      action: () => void navigate({ to: APP_ROUTES.DASHBOARD_PIPELINES }),
    });
  }, [keyboard, tourMode, navigate]);

  useEffect(() => {
    if (importOpen) {
      importTriggerRef.current?.click();
      setImportOpen(false);
    }
  }, [importOpen]);

  const notifyFailure = (error: unknown, fallback: string) => {
    notify(error instanceof Error ? error.message : fallback, "error");
  };

  const handleSave = async () => {
    try {
      await autoSave.save();
    } catch (error) {
      notifyFailure(error, "Failed to save pipeline");
    }
  };

  const handleNewPipeline = async () => {
    try {
      const name = (generate(4) as string[]).join(" ");
      await navigate(newDraft(name));
    } catch (error) {
      notifyFailure(error, "Unable to create pipeline");
    }
  };

  const handleSavePipelineAs = async (name: string) => {
    try {
      const source = pipelineFileStore.activePipelineFile;
      const snapshot =
        navigation.rootSpec &&
        JSON.stringify(serializeComponentSpec(navigation.rootSpec));
      const file = await savePipelineAs(navigation, name, storage, source);
      if (!file) return;
      if (
        source?.remote &&
        snapshot &&
        getRemotePipelineDeletionError({ source: "remote", ...source.remote })
      )
        autoSave.releaseRecoveredCopy(source, snapshot);
      notify(`Pipeline saved as "${name}"`, "success");
      await navigate({
        to: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
        params: { pipelineId: file.id },
      });
    } catch (error) {
      notifyFailure(error, "Failed to save pipeline copy");
    }
  };

  const getRenameInitialName = () => navigation.rootSpec?.name ?? "";

  const handleExport = () => {
    exportCurrentPipeline(navigation);
  };

  const getSaveAsInitialName = () => {
    const currentName = navigation.rootSpec?.name;
    return currentName
      ? `${currentName} (Copy)`
      : `Untitled Pipeline ${new Date().toLocaleTimeString()}`;
  };

  return {
    importTriggerRef,
    saveAsDialogOpen,
    setSaveAsDialogOpen,
    renameDialogOpen,
    setRenameDialogOpen,
    renamePipeline,
    getRenameInitialName,
    setImportOpen,
    handleSave,
    handleNewPipeline,
    handleSavePipelineAs,
    handleExport,
    getSaveAsInitialName,
  };
}
