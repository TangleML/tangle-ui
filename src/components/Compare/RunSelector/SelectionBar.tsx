import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { PipelineRun } from "@/types/pipelineRun";
import { pluralize } from "@/utils/string";

interface SelectionBarProps {
  selectedRuns: PipelineRun[];
  onCompare: () => void;
  onClearSelection: () => void;
}

export const SelectionBar = ({
  selectedRuns,
  onCompare,
  onClearSelection,
}: SelectionBarProps) => {
  const canCompare = selectedRuns.length >= 2;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-background border border-border rounded-lg shadow-lg p-4 z-50">
      <InlineStack gap="4" blockAlign="center">
        <Text size="sm" weight="semibold">
          {selectedRuns.length} {pluralize(selectedRuns.length, "run")} selected
        </Text>

        <InlineStack gap="2">
          <Button
            variant="default"
            size="sm"
            onClick={onCompare}
            disabled={!canCompare}
          >
            <Icon name="GitCompareArrows" />
            Compare {selectedRuns.length}{" "}
            {pluralize(selectedRuns.length, "run")}
          </Button>

          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            <Icon name="X" />
          </Button>
        </InlineStack>
      </InlineStack>
    </div>
  );
};

