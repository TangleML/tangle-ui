import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import { TrimmedDigest } from "@/components/shared/ManageComponent/TrimmedDigest";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
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
import { generateDigest } from "@/utils/componentStore";
import { downloadYamlFromComponentText } from "@/utils/URL";

interface PipelineDigestBarProps {
  yamlText: string;
  pipelineName: string;
}

export const PipelineDigestBar = withSuspenseWrapper(
  function PipelineDigestBar({
    yamlText,
    pipelineName,
  }: PipelineDigestBarProps) {
    const notify = useToastNotification();
    const [showCodeViewer, setShowCodeViewer] = useState(false);

    const { data: generatedDigest } = useQuery({
      queryKey: ["pipeline-digest", yamlText],
      staleTime: 0,
      queryFn: () => generateDigest(yamlText),
    });

    const digest = generatedDigest ?? "...";

    const handleCopyDigest = () => {
      navigator.clipboard.writeText(digest).then(
        () => notify("Digest copied to clipboard", "success"),
        (err) => notify("Failed to copy digest: " + err, "error"),
      );
    };

    const handleCopyYaml = () => {
      navigator.clipboard.writeText(yamlText).then(
        () => notify("YAML copied to clipboard", "success"),
        (err) => notify("Failed to copy YAML: " + err, "error"),
      );
    };

    const handleDownloadYaml = () => {
      downloadYamlFromComponentText(yamlText, pipelineName);
    };

    return (
      <>
        <InlineStack
          gap="1"
          blockAlign="center"
          wrap="nowrap"
          className="w-full rounded-md border px-2 py-1"
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 hover:bg-accent"
            onClick={() => setShowCodeViewer(true)}
          >
            <Icon
              name="GitBranch"
              size="sm"
              className="shrink-0 text-muted-foreground"
            />
            <TrimmedDigest
              digest={digest}
              className="min-w-0 shrink truncate text-muted-foreground"
            />
          </button>

          <InlineStack gap="0" blockAlign="center" className="shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="min"
                  onClick={handleCopyDigest}
                >
                  <Icon name="Copy" size="sm" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy digest</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="min">
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

                <DropdownMenuItem onClick={handleCopyYaml}>
                  <Icon name="Clipboard" size="sm" />
                  Copy YAML
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </InlineStack>
        </InlineStack>

        {showCodeViewer && (
          <CodeViewer
            code={yamlText}
            language="yaml"
            filename={pipelineName}
            fullscreen
            onClose={() => setShowCodeViewer(false)}
          />
        )}
      </>
    );
  },
);
