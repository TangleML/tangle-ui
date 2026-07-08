import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { NavigationEntry } from "@/routes/v2/shared/store/navigationStore";
import { tracking } from "@/utils/tracking";

import { PipelineDigestBar } from "./PipelineDigestBar";
import { PipelineNavigationBreadcrumb } from "./PipelineNavigationBreadcrumb";

interface PipelineDetailsHeaderProps {
  canNavigateBack: boolean;
  navigationPath: readonly NavigationEntry[];
  onNavigateToLevel: (index: number) => void;
  isNestedSubgraph: boolean;
  pipelineName: string;
  yamlText: string;
  onRenameSubgraph?: (newName: string) => boolean;
}

export function PipelineDetailsHeader({
  canNavigateBack,
  navigationPath,
  onNavigateToLevel,
  isNestedSubgraph,
  pipelineName,
  yamlText,
  onRenameSubgraph,
}: PipelineDetailsHeaderProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const canRename = isNestedSubgraph && onRenameSubgraph !== undefined;

  const handleRenameSubmit = () => {
    const newName = renameInputRef.current?.value.trim();
    setIsRenaming(false);
    if (newName && newName !== pipelineName) {
      onRenameSubgraph?.(newName);
    }
  };

  const startRename = () => {
    setIsRenaming(true);
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  };

  return (
    <BlockStack gap="2" className="shrink-0 px-4 pb-2 pt-3">
      <PipelineNavigationBreadcrumb
        canNavigateBack={canNavigateBack}
        navigationPath={navigationPath}
        onNavigateToLevel={onNavigateToLevel}
      />
      <InlineStack
        gap="2"
        blockAlign="center"
        wrap="nowrap"
        className="min-w-0 w-full"
      >
        {isNestedSubgraph && (
          <Icon name="Workflow" size="sm" className="shrink-0" />
        )}
        {canRename && isRenaming ? (
          <Input
            ref={renameInputRef}
            defaultValue={pipelineName}
            className="h-7 text-sm font-semibold flex-1 min-w-0"
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") setIsRenaming(false);
            }}
          />
        ) : canRename ? (
          <div className="group min-w-0 flex items-baseline gap-1">
            <Text
              size="md"
              weight="semibold"
              className="wrap-anywhere select-text"
            >
              {pipelineName}
            </Text>
            <Button
              variant="ghost"
              size="inline-xs"
              className="shrink-0 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={startRename}
              aria-label="Rename subgraph"
              {...tracking("v2.pipeline_editor.subgraph_details.rename_start")}
            >
              <Icon name="Pencil" size="xs" />
            </Button>
          </div>
        ) : (
          <Text size="md" weight="semibold" className="wrap-anywhere min-w-0">
            {pipelineName}
          </Text>
        )}
      </InlineStack>

      <PipelineDigestBar
        yamlText={yamlText}
        pipelineName={pipelineName}
        isNestedSubgraph={isNestedSubgraph}
      />
    </BlockStack>
  );
}
