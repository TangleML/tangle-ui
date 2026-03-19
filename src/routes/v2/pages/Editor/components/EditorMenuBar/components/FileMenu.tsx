import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import ImportPipeline from "@/components/shared/ImportPipeline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { APP_ROUTES } from "@/routes/router";
import { autoSaveStore } from "@/routes/v2/pages/Editor/store/autoSaveStore";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { ShorcutBadge } from "@/routes/v2/shared/components/ShorcutBadge";
import { CTRL } from "@/routes/v2/shared/shortcuts/keys";
import { registerShortcut } from "@/routes/v2/shared/store/keyboardStore";

import { createNewPipeline, exportCurrentPipeline } from "./fileMenu.actions";
import { OpenPipelineDialog } from "./OpenPipelineDialog";

export function FileMenu() {
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const importTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return registerShortcut({
      id: "open-pipeline",
      keys: [CTRL, "O"],
      label: "Open Pipeline",
      action: () => setOpenDialogOpen(true),
    });
  }, []);

  useEffect(() => {
    if (importOpen) {
      importTriggerRef.current?.click();
      setImportOpen(false);
    }
  }, [importOpen]);

  const handleNewPipeline = async () => {
    const name = await createNewPipeline();
    navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: name },
    });
  };

  const handlePipelineClick = (name: string) => {
    navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: name },
    });
    setOpenDialogOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton>File</MenuTriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={2}>
          <DropdownMenuItem onClick={() => setOpenDialogOpen(true)}>
            <Icon name="FolderOpen" size="sm" />
            Open
            <DropdownMenuShortcut>
              <ShorcutBadge id="open-pipeline" />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void autoSaveStore.save()}>
            <Icon name="Save" size="sm" />
            Save
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Icon name="SaveAll" size="sm" />
            Save as
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleNewPipeline}>
            <Icon name="Plus" size="sm" />
            New pipeline
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setImportOpen(true)}>
            <Icon name="Upload" size="sm" />
            Import
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportCurrentPipeline}>
            <Icon name="FileDown" size="sm" />
            Export
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <OpenPipelineDialog
        open={openDialogOpen}
        onOpenChange={setOpenDialogOpen}
        onPipelineClick={handlePipelineClick}
      />

      <ImportPipeline
        triggerComponent={
          <button
            ref={importTriggerRef}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
          />
        }
      />
    </>
  );
}
