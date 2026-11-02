import { useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import { useComponentEditor } from "@/components/shared/ComponentEditor/ComponentEditorProvider";
import { ComponentReferenceBar } from "@/components/shared/TaskDetails/ComponentReferenceBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useToastNotification from "@/hooks/useToastNotification";
import type { ComponentReference as ModelComponentReference } from "@/models/componentSpec/entities/types";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { tracking } from "@/utils/tracking";
import {
  downloadStringAsFile,
  downloadYamlFromComponentText,
} from "@/utils/URL";

interface ComponentRefBarProps {
  componentRef: ModelComponentReference;
  yamlText: string;
  taskName: string;
  pythonCode: string | undefined;
  readOnly?: boolean;
}

export function ComponentRefBar({
  componentRef,
  yamlText,
  taskName,
  pythonCode,
  readOnly = false,
}: ComponentRefBarProps) {
  const { track } = useAnalytics();
  const notify = useToastNotification();
  const { openComponentEditor } = useComponentEditor();
  const [showCodeViewer, setShowCodeViewer] = useState(false);

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(yamlText).then(
      () => notify("YAML copied to clipboard", "success"),
      (err) => notify("Failed to copy YAML: " + err, "error"),
    );
  };

  const handleDownloadYaml = () => {
    downloadYamlFromComponentText(yamlText, taskName);
  };

  const handleDownloadPython = () => {
    if (pythonCode) {
      downloadStringAsFile(pythonCode, `${taskName}.py`, "text/x-python");
    }
  };

  return (
    <>
      <ComponentReferenceBar
        componentRef={componentRef}
        readOnly={readOnly}
        trackingId="v2.pipeline_editor.task_details.component_details_open"
      >
        <InlineStack blockAlign="center" className="shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="min"
                onClick={() => setShowCodeViewer(true)}
                {...tracking("v2.pipeline_editor.task_details.view_task_yaml")}
              >
                <Icon name="FileCode" size="sm" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View YAML</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="min"
                    {...tracking(
                      "v2.pipeline_editor.task_details.component_ref_menu",
                    )}
                  >
                    <Icon name="EllipsisVertical" size="sm" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More actions</TooltipContent>
            </Tooltip>

            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  track("v2.pipeline_editor.task_details.download_yaml.click");
                  handleDownloadYaml();
                }}
              >
                <Icon name="Download" size="sm" />
                Download YAML
              </DropdownMenuItem>

              {pythonCode && (
                <DropdownMenuItem
                  onClick={() => {
                    track(
                      "v2.pipeline_editor.task_details.download_python.click",
                    );
                    handleDownloadPython();
                  }}
                >
                  <Icon name="Download" size="sm" />
                  Download Python
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={() => {
                  track("v2.pipeline_editor.task_details.copy_yaml.click");
                  handleCopyYaml();
                }}
              >
                <Icon name="Clipboard" size="sm" />
                Copy YAML
              </DropdownMenuItem>

              {!readOnly && (
                <DropdownMenuItem
                  onClick={() => {
                    track(
                      "v2.pipeline_editor.task_details.edit_component.click",
                    );
                    openComponentEditor({ text: yamlText });
                  }}
                >
                  <Icon name="FilePenLine" size="sm" />
                  Edit Component
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </InlineStack>
      </ComponentReferenceBar>

      {showCodeViewer && (
        <CodeViewer
          code={yamlText}
          language="yaml"
          filename={taskName}
          fullscreen
          onClose={() => setShowCodeViewer(false)}
        />
      )}
    </>
  );
}
