import { useNavigate } from "@tanstack/react-router";
import { type RefObject, useEffect, useRef, useState } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { getEditorLocation } from "@/routes/editorRoutes";
import { APP_ROUTES } from "@/routes/router";
import { usePipelineRename } from "@/routes/v2/pages/Editor/hooks/usePipelineRename";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { CTRL } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { PipelineRef } from "@/services/pipelineStorage/types";

import {
  createNewPipeline,
  exportCurrentPipeline,
  savePipelineAs,
} from "./fileMenu.actions";

interface FileMenuState {
  importTriggerRef: RefObject<HTMLButtonElement | null>;
  openDialogOpen: boolean;
  setOpenDialogOpen: (open: boolean) => void;
  saveAsDialogOpen: boolean;
  setSaveAsDialogOpen: (open: boolean) => void;
  renameDialogOpen: boolean;
  setRenameDialogOpen: (open: boolean) => void;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  renamePipeline: (name: string) => void;
  getRenameInitialName: () => string;
  setImportOpen: (open: boolean) => void;
  handleSave: () => void;
  handleNewPipeline: () => void;
  handlePipelineClick: (pipeline: PipelineRef) => void;
  handleSavePipelineAs: (name: string) => void;
  handleExport: () => void;
  getSaveAsInitialName: () => string;
  handleDeletePipeline: () => void;
}

export function useFileMenuState(): FileMenuState {
  const { keyboard, navigation } = useSharedStores();
  const { autoSave, pipelineFile: pipelineFileStore } = useEditorSession();
  const renamePipeline = usePipelineRename();
  const storage = usePipelineStorage();
  const tourMode = useTourMode();
  const navigate = useNavigate();
  const notify = useToastNotification();
  const [importOpen, setImportOpen] = useState(false);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const importTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (tourMode) return;
    return keyboard.registerShortcut({
      id: "open-pipeline",
      keys: [CTRL, "O"],
      label: "Open Pipeline",
      action: () => setOpenDialogOpen(true),
    });
  }, [keyboard, tourMode]);

  useEffect(() => {
    if (importOpen) {
      importTriggerRef.current?.click();
      setImportOpen(false);
    }
  }, [importOpen]);

  const handleSave = () => {
    void autoSave.save();
  };

  const handleNewPipeline = async () => {
    try {
      const file = await createNewPipeline(storage);
      navigate(getEditorLocation(file));
    } catch (error) {
      notify(`Could not create pipeline: ${error}`, "error");
    }
  };

  const handlePipelineClick = (pipeline: PipelineRef) => {
    navigate(getEditorLocation(pipeline));
    setOpenDialogOpen(false);
  };

  const handleSavePipelineAs = async (name: string) => {
    try {
      const file = await savePipelineAs(
        navigation,
        name,
        storage,
        pipelineFileStore.activePipelineFile ?? undefined,
      );
      if (!file) return;
      notify(
        file.storageKind === "pending"
          ? `Pipeline "${name}" is pending upload`
          : `Pipeline saved as "${name}"`,
        file.storageKind === "pending" ? "warning" : "success",
      );
      navigate(getEditorLocation(file));
    } catch (error) {
      notify(`Could not clone pipeline: ${error}`, "error");
    }
  };

  const getRenameInitialName = () => navigation.rootSpec?.name ?? "";

  const handleExport = () => {
    exportCurrentPipeline(navigation);
  };

  const handleDeletePipeline = async () => {
    const file = pipelineFileStore.activePipelineFile;
    if (!file?.canEdit) return;
    await autoSave.dispose();
    try {
      await file.deleteFile();
      void navigate({ to: APP_ROUTES.HOME });
    } catch (error) {
      if (navigation.rootSpec) autoSave.init(navigation.rootSpec);
      notify(`Could not delete pipeline: ${error}`, "error");
    }
  };

  const getSaveAsInitialName = () => {
    const currentName = navigation.rootSpec?.name;
    return currentName
      ? `${currentName} (Copy)`
      : `Untitled Pipeline ${new Date().toLocaleTimeString()}`;
  };

  return {
    importTriggerRef,
    openDialogOpen,
    setOpenDialogOpen,
    saveAsDialogOpen,
    setSaveAsDialogOpen,
    renameDialogOpen,
    setRenameDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    renamePipeline,
    getRenameInitialName,
    setImportOpen,
    handleSave,
    handleNewPipeline,
    handlePipelineClick,
    handleSavePipelineAs,
    handleExport,
    getSaveAsInitialName,
    handleDeletePipeline,
  };
}
