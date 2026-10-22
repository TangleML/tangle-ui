import { useNavigate } from "@tanstack/react-router";
import { generate } from "random-words";
import { type RefObject, useEffect, useRef, useState } from "react";

import { useNewPipelineDraft } from "@/hooks/useNewPipelineDraft";
import useToastNotification from "@/hooks/useToastNotification";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
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
  const newDraft = useNewPipelineDraft();
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
      const draft = newDraft(name);
      if (draft) {
        await navigate(draft);
        return;
      }
      const file = await createNewPipeline(storage, name);
      navigate({
        to: APP_ROUTES.PIPELINE_EDITOR,
        params: { pipelineName: file.storageKey },
        search: { fileId: file.id },
      });
    } catch (error) {
      notifyFailure(error, "Unable to create pipeline");
    }
  };

  const handlePipelineClick = (pipeline: PipelineRef) => {
    navigate({
      to: APP_ROUTES.PIPELINE_EDITOR,
      params: { pipelineName: pipeline.name },
      search: { fileId: pipeline.fileId },
    });
    setOpenDialogOpen(false);
  };

  const handleSavePipelineAs = async (name: string) => {
    try {
      const file = await savePipelineAs(
        navigation,
        name,
        storage,
        pipelineFileStore.activePipelineFile,
      );
      if (!file) return;
      notify(`Pipeline saved as "${name}"`, "success");
      if (file.remote) {
        await navigate({
          to: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
          params: { pipelineId: file.id },
        });
      } else {
        await navigate({
          to: APP_ROUTES.PIPELINE_EDITOR,
          params: { pipelineName: file.storageKey },
          search: { fileId: file.id },
        });
      }
    } catch (error) {
      notifyFailure(error, "Failed to save pipeline copy");
    }
  };

  const getRenameInitialName = () => navigation.rootSpec?.name ?? "";

  const handleExport = () => {
    exportCurrentPipeline(navigation);
  };

  const handleDeletePipeline = async () => {
    const file = pipelineFileStore.activePipelineFile;
    if (!file || file.remote || file.isDraft) return;
    await file.deleteFile();
    void navigate({ to: APP_ROUTES.HOME });
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
