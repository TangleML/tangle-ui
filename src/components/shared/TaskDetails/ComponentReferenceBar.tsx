import { type ReactNode, useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
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
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { ComponentReference } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";
import { isSubgraph } from "@/utils/subgraphUtils";
import { tracking } from "@/utils/tracking";
import {
  downloadStringAsFile,
  downloadYamlFromComponentText,
} from "@/utils/URL";

interface ComponentReferenceBarProps {
  componentRef: ComponentReference;
  yamlText: string;
  filename: string;
  pythonCode?: string;
  pythonFilename?: string;
  readOnly?: boolean;
  trackingPrefix: string;
  onEditComponent?: () => void;
  additionalMenuItems?: ReactNode;
}

export function ComponentReferenceBar({
  componentRef,
  yamlText,
  filename,
  pythonCode,
  pythonFilename = filename,
  readOnly = false,
  trackingPrefix,
  onEditComponent,
  additionalMenuItems,
}: ComponentReferenceBarProps) {
  const { track } = useAnalytics();
  const notify = useToastNotification();
  const [showCodeViewer, setShowCodeViewer] = useState(false);
  const displayName = componentRef.name ?? getComponentName(componentRef);
  const isSubgraphSpec = isSubgraph(componentRef.spec);

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(yamlText).then(
      () => notify("YAML copied to clipboard", "success"),
      (err) => notify("Failed to copy YAML: " + err, "error"),
    );
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
          component={componentRef}
          displayName={displayName}
          readOnly={readOnly}
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="min"
              align="start"
              className="min-w-0 flex-1 gap-1.5 px-1 py-0.5"
              {...tracking(`${trackingPrefix}.component_details_open`)}
            >
              <Icon
                name={isSubgraphSpec ? "Workflow" : "File"}
                size="sm"
                className={cn(
                  "shrink-0",
                  isSubgraphSpec ? "text-info" : "text-muted-foreground",
                )}
              />
              <Text size="xs" className="truncate">
                {displayName}
              </Text>
              {componentRef.digest && (
                <TrimmedDigest
                  digest={componentRef.digest}
                  tooltip={false}
                  className="shrink-0 text-muted-foreground"
                />
              )}
            </Button>
          }
        />
        <InlineStack blockAlign="center" className="shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="min"
                aria-label="View YAML"
                onClick={() => setShowCodeViewer(true)}
                {...tracking(`${trackingPrefix}.view_task_yaml`)}
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
                    aria-label="More actions"
                    {...tracking(`${trackingPrefix}.component_ref_menu`)}
                  >
                    <Icon name="EllipsisVertical" size="sm" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More actions</TooltipContent>
            </Tooltip>

            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  track(`${trackingPrefix}.download_yaml.click`);
                  downloadYamlFromComponentText(yamlText, filename);
                }}
              >
                <Icon name="Download" size="sm" />
                Download YAML
              </DropdownMenuItem>

              {pythonCode && (
                <DropdownMenuItem
                  onSelect={() => {
                    track(`${trackingPrefix}.download_python.click`);
                    downloadStringAsFile(
                      pythonCode,
                      `${pythonFilename}.py`,
                      "text/x-python",
                    );
                  }}
                >
                  <Icon name="Download" size="sm" />
                  Download Python
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onSelect={() => {
                  track(`${trackingPrefix}.copy_yaml.click`);
                  handleCopyYaml();
                }}
              >
                <Icon name="Clipboard" size="sm" />
                Copy YAML
              </DropdownMenuItem>

              {!readOnly && onEditComponent && (
                <DropdownMenuItem
                  onSelect={() => {
                    track(`${trackingPrefix}.edit_component.click`);
                    onEditComponent();
                  }}
                >
                  <Icon name="FilePenLine" size="sm" />
                  Edit Component
                </DropdownMenuItem>
              )}

              {additionalMenuItems}
            </DropdownMenuContent>
          </DropdownMenu>
        </InlineStack>
      </InlineStack>

      {showCodeViewer && (
        <CodeViewer
          code={yamlText}
          language="yaml"
          filename={filename}
          fullscreen
          onClose={() => setShowCodeViewer(false)}
        />
      )}
    </>
  );
}
