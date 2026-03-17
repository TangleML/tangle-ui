import { useNavigate } from "@tanstack/react-router";
import { generate } from "random-words";
import { useEffect, useRef, useState } from "react";

import ImportPipeline from "@/components/shared/ImportPipeline";
import { exportPipeline } from "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { JsonSerializer } from "@/models/componentSpec/serialization/jsonSerializer";
import { CTRL } from "@/routes/EditorV2/shortcuts/keys";
import { registerShortcut } from "@/routes/EditorV2/store/keyboardStore";
import { navigationStore } from "@/routes/EditorV2/store/navigationStore";
import { PipelineFolders } from "@/routes/PipelineFolders/PipelineFolders";
import { APP_ROUTES } from "@/routes/router";
import { type ComponentSpec as WiredComponentSpec } from "@/utils/componentSpec";
import { writeComponentToFileListFromText } from "@/utils/componentStore";
import {
  defaultPipelineYamlWithName,
  USER_PIPELINES_LIST_NAME,
} from "@/utils/constants";
import { componentSpecToYaml } from "@/utils/yaml";

import { autoSaveStore } from "../../../store/autoSaveStore";
import { ShorcutBadge } from "../../ShorcutBadge";
import { MenuTriggerButton } from "./MenuTriggerButton";

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
    const name = (generate(4) as string[]).join(" ");
    const componentText = defaultPipelineYamlWithName(name);
    await writeComponentToFileListFromText(
      USER_PIPELINES_LIST_NAME,
      name,
      componentText,
    );
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

  const handleExportPipeline = () => {
    const serializer = new JsonSerializer();
    const componentSpec = navigationStore.rootSpec;

    if (!componentSpec) return;

    const componentText = componentSpecToYaml(
      serializer.serialize(componentSpec) as WiredComponentSpec,
    );
    exportPipeline(componentSpec.name ?? "Untitled Pipeline", componentText);
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
          <DropdownMenuItem onClick={handleExportPipeline}>
            <Icon name="FileDown" size="sm" />
            Export
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={openDialogOpen}
        onOpenChange={setOpenDialogOpen}
        data-testid="open-pipeline-dialog"
      >
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-full">
          <DialogHeader>
            <DialogTitle>Open Pipeline</DialogTitle>
          </DialogHeader>
          <BlockStack gap="4" className="w-full h-[80vh] overflow-y-auto">
            <PipelineFolders onPipelineClick={handlePipelineClick} />
          </BlockStack>
        </DialogContent>
      </Dialog>

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
