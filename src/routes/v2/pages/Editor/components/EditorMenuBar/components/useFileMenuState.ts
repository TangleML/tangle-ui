import { useNavigate } from "@tanstack/react-router";
import { type RefObject, useEffect, useRef, useState } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/router";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
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
  handleRename: (name: string) => void;
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
  const { renamePipeline } = usePipelineActions();
  const storage = usePipelineStorage();
  const navigate = useNavigate();
  const notify = useToastNotification();
  const [importOpen, setImportOpen] = useState(false);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const importTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return keyboard.registerShortcut({
      id: "open-pipeline",
      keys: [CTRL, "O"],
      label: "Open Pipeline",
      action: () => setOpenDialogOpen(true),
    });
  }, [keyboard]);

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
    const file = await createNewPipeline(storage);
    navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: file.storageKey },
      search: { fileId: file.id },
    });
  };

  const handlePipelineClick = (pipeline: PipelineRef) => {
    navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: pipeline.name },
      search: { fileId: pipeline.fileId },
    });
    setOpenDialogOpen(false);
  };

  const handleSavePipelineAs = async (name: string) => {
    const file = await savePipelineAs(navigation, name, storage);
    notify(`Pipeline saved as "${name}"`, "success");
    navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: name },
      search: { fileId: file?.id },
    });
  };

  const handleRename = async (newName: string) => {
    const spec = navigation.rootSpec;
    if (!spec) return;
    await pipelineFileStore.activePipelineFile?.rename(newName);
    renamePipeline(spec, newName);
    await autoSave.save();
    await navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: newName },
      search: { fileId: pipelineFileStore.activePipelineFile?.id },
    });
  };

  const getRenameInitialName = () => navigation.rootSpec?.name ?? "";

  const handleExport = () => {
    exportCurrentPipeline(navigation);
  };

  const handleDeletePipeline = async () => {
    const file = pipelineFileStore.activePipelineFile;
    if (!file) return;
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
    handleRename,
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
