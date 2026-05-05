import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { NavigationEntry } from "@/routes/v2/shared/store/navigationStore";

import { PipelineDigestBar } from "./PipelineDigestBar";
import { PipelineNavigationBreadcrumb } from "./PipelineNavigationBreadcrumb";

interface PipelineDetailsHeaderProps {
  canNavigateBack: boolean;
  navigationPath: readonly NavigationEntry[];
  onNavigateToLevel: (index: number) => void;
  isNestedSubgraph: boolean;
  pipelineName: string;
  yamlText: string;
}

export function PipelineDetailsHeader({
  canNavigateBack,
  navigationPath,
  onNavigateToLevel,
  isNestedSubgraph,
  pipelineName,
  yamlText,
}: PipelineDetailsHeaderProps) {
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
        <Text size="md" weight="semibold" className="wrap-anywhere min-w-0">
          {pipelineName}
        </Text>
      </InlineStack>

      <PipelineDigestBar
        yamlText={yamlText}
        pipelineName={pipelineName}
        isNestedSubgraph={isNestedSubgraph}
      />
    </BlockStack>
  );
}
