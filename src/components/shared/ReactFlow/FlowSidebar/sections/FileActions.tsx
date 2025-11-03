import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PipelineNameDialog } from "@/components/shared/Dialogs";
import ImportPipeline from "@/components/shared/ImportPipeline";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useAutoSaveStatus } from "@/providers/AutoSaveProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { EDITOR_PATH } from "@/routes/router";
import { getPipelineFile, useSavePipeline } from "@/services/pipelineService";
import { componentSpecToYaml } from "@/utils/componentStore";
import { formatRelativeTime } from "@/utils/date";

const FileActions = ({ isOpen }: { isOpen: boolean }) => {
  const { componentSpec } = useComponentSpec();
  const { autoSaveStatus } = useAutoSaveStatus();
  const { savePipeline } = useSavePipeline(componentSpec);
  const notify = useToastNotification();
  const navigate = useNavigate();

  const [onLoadLastSavedAt, setOnLoadLastSavedAt] = useState<Date | null>(null);

  const componentText = (() => {
    try {
      return componentSpecToYaml(componentSpec);
    } catch (err) {
      console.error("Error preparing pipeline for export:", err);
      return componentSpec ? componentSpecToYaml(componentSpec) : "";
    }
  })();

  const notifyPipelineSaved = (name: string) => {
    notify(`Pipeline saved as "${name}"`, "success");
  };

  const handleSavePipeline = async () => {
    await savePipeline();
    setOnLoadLastSavedAt(new Date());
    notifyPipelineSaved(componentSpec?.name ?? "Untitled Pipeline");
  };

  const handleSavePipelineAs = async (name: string) => {
    await savePipeline(name);
    notifyPipelineSaved(name);

    navigate({
      to: `${EDITOR_PATH}/${encodeURIComponent(name)}`,
    });
  };

  const getAutoSaveStatusText = () => {
    if (autoSaveStatus.isSaving) {
      return "Saving...";
    }
    if (autoSaveStatus.lastSavedAt || onLoadLastSavedAt) {
      return `Last saved ${formatRelativeTime(
        autoSaveStatus.lastSavedAt ?? onLoadLastSavedAt,
      )}`;
    }
    return "All changes saved";
  };

  const getDuplicatePipelineName = () => {
    return componentSpec?.name
      ? `${componentSpec.name} (Copy)`
      : `Untitled Pipeline ${new Date().toLocaleTimeString()}`;
  };

  useEffect(() => {
    const fetchLastSaved = async () => {
      if (componentSpec?.name) {
        const lastSavedPipeline = await getPipelineFile(componentSpec.name);
        setOnLoadLastSavedAt(lastSavedPipeline?.modificationTime ?? null);
      }
    };
    fetchLastSaved();
  }, [componentSpec?.name]);

  const componentTextBlob = new Blob([componentText], { type: "text/yaml" });
  const filename = componentSpec?.name
    ? `${componentSpec.name}.pipeline.component.yaml`
    : "pipeline.component.yaml";

  const tooltipPosition = isOpen ? "top" : "right";

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Pipeline Actions</SidebarGroupLabel>
      <SidebarContent>
        <InlineStack
          blockAlign="center"
          className="ml-2 overflow-y-hidden"
          gap="1"
        >
          {autoSaveStatus.isSaving && <Spinner size={16} />}
          <span className="text-xs text-muted-foreground">
            {getAutoSaveStatusText()}
          </span>
        </InlineStack>
      </SidebarContent>
      <SidebarGroupContent>
        <SidebarMenu
          className={cn({
            "gap-2 text-foreground/75": true,
            "flex-row": isOpen,
            "flex-col": !isOpen,
          })}
        >
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Save Pipeline"
              forceTooltip
              tooltipPosition={tooltipPosition}
              onClick={handleSavePipeline}
            >
              <Icon name="Save" size="lg" className="stroke-[1.5]" />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <PipelineNameDialog
              trigger={
                <SidebarMenuButton
                  tooltip="Save Pipeline As"
                  forceTooltip
                  tooltipPosition={tooltipPosition}
                >
                  <Icon name="SaveAll" size="lg" className="stroke-[1.5]" />
                </SidebarMenuButton>
              }
              title="Save Pipeline As"
              description="Enter a name for your pipeline"
              initialName={getDuplicatePipelineName()}
              onSubmit={handleSavePipelineAs}
              submitButtonText="Save"
              submitButtonIcon={<Icon name="SaveAll" className="mr-2" />}
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Export Pipeline"
              forceTooltip
              tooltipPosition={tooltipPosition}
              asChild
            >
              <a
                href={URL.createObjectURL(componentTextBlob)}
                download={filename}
              >
                <Icon name="FileDown" size="lg" className="stroke-[1.5]" />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ImportPipeline
              triggerComponent={
                <SidebarMenuButton
                  tooltip="Import Pipeline"
                  forceTooltip
                  tooltipPosition={tooltipPosition}
                  asChild={!isOpen}
                >
                  <Icon name="FileUp" size="lg" className="stroke-[1.5]" />
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default FileActions;
