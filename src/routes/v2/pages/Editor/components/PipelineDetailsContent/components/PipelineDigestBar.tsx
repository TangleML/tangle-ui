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
import useToastNotification from "@/hooks/useToastNotification";
import { generateDigest } from "@/utils/componentStore";
import { downloadYamlFromComponentText } from "@/utils/URL";

function formatClipboardError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface PipelineDigestBarProps {
  yamlText: string;
  pipelineName: string;
  isNestedSubgraph: boolean;
}

export const PipelineDigestBar = withSuspenseWrapper(
  function PipelineDigestBar({
    yamlText,
    pipelineName,
    isNestedSubgraph,
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
        (err: unknown) =>
          notify(
            `Failed to copy digest: ${formatClipboardError(err)}`,
            "error",
          ),
      );
    };

    const handleCopyYaml = () => {
      navigator.clipboard.writeText(yamlText).then(
        () => notify("YAML copied to clipboard", "success"),
        (err: unknown) =>
          notify(`Failed to copy YAML: ${formatClipboardError(err)}`, "error"),
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
          <Button
            variant="ghost"
            aria-label="View pipeline YAML"
            className="h-auto min-h-0 min-w-0 flex-1 justify-start gap-1.5 px-1 py-0.5 font-normal"
            onClick={() => setShowCodeViewer(true)}
          >
            <Icon
              name={isNestedSubgraph ? "Workflow" : "GitBranch"}
              size="sm"
              className="shrink-0 text-muted-foreground"
            />
            <TrimmedDigest
              digest={digest}
              className="min-w-0 shrink truncate text-muted-foreground"
            />
          </Button>

          <InlineStack gap="0" blockAlign="center" className="shrink-0">
            <Button variant="ghost" size="min" onClick={handleCopyDigest}>
              <Icon name="Copy" size="sm" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="min">
                  <Icon name="EllipsisVertical" size="sm" />
                </Button>
              </DropdownMenuTrigger>

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
