import { useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import { ComponentEditorDialog } from "@/components/shared/ComponentEditor/ComponentEditorDialog";
import ComponentDetailsDialog from "@/components/shared/Dialogs/ComponentDetailsDialog";
import { TrimmedDigest } from "@/components/shared/ManageComponent/TrimmedDigest";
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
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import type { ComponentReference as ModelComponentReference } from "@/models/componentSpec/entities/types";
import type { ComponentReference } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";
import { isSubgraph } from "@/utils/subgraphUtils";
import {
  downloadStringAsFile,
  downloadYamlFromComponentText,
} from "@/utils/URL";

interface ComponentRefBarProps {
  componentRef: ModelComponentReference;
  yamlText: string;
  taskName: string;
  pythonCode: string | undefined;
}

export function ComponentRefBar({
  componentRef,
  yamlText,
  taskName,
  pythonCode,
}: ComponentRefBarProps) {
  const notify = useToastNotification();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showCodeViewer, setShowCodeViewer] = useState(false);

  // The model ComponentReference is structurally compatible at runtime
  const utilsRef = componentRef as unknown as ComponentReference;
  const displayName = componentRef.name ?? getComponentName(utilsRef);

  const isSubgraphSpec = isSubgraph(utilsRef.spec);
  const iconName = isSubgraphSpec ? "Workflow" : "File";
  const iconColor = isSubgraphSpec ? "text-blue-500" : "text-muted-foreground";

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
      <InlineStack
        gap="1"
        blockAlign="center"
        wrap="nowrap"
        className="w-full rounded-md border px-2 py-1"
      >
        <ComponentDetailsDialog
          component={utilsRef}
          displayName={displayName}
          trigger={
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 hover:bg-accent"
            >
              <Icon
                name={iconName}
                size="sm"
                className={`shrink-0 ${iconColor}`}
              />
              <Text size="xs" className="truncate">
                {displayName}
              </Text>
              {componentRef.digest && (
                <TrimmedDigest
                  digest={componentRef.digest}
                  className="shrink-0 text-muted-foreground"
                />
              )}
            </button>
          }
        />

        <InlineStack gap="0" blockAlign="center" className="shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="min"
                onClick={() => setIsEditDialogOpen(true)}
              >
                <Icon name="FilePenLine" size="sm" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit Component Definition</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="min">
                    <Icon name="EllipsisVertical" size="sm" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More actions</TooltipContent>
            </Tooltip>

            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadYaml}>
                <Icon name="Download" size="sm" />
                Download YAML
              </DropdownMenuItem>

              {pythonCode && (
                <DropdownMenuItem onClick={handleDownloadPython}>
                  <Icon name="Download" size="sm" />
                  Download Python
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={handleCopyYaml}>
                <Icon name="Clipboard" size="sm" />
                Copy YAML
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setShowCodeViewer(true)}>
                <Icon name="FileCode" size="sm" />
                View YAML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </InlineStack>
      </InlineStack>

      {isEditDialogOpen && (
        <ComponentEditorDialog
          text={yamlText}
          onClose={() => setIsEditDialogOpen(false)}
        />
      )}

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
