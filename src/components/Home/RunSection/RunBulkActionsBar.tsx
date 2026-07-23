import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";
import { pluralize } from "@/utils/string";
import { tracking } from "@/utils/tracking";

interface RunBulkActionsBarProps {
  selectedRuns: string[];
  onClearSelection: () => void;
}

const RunBulkActionsBar = ({
  selectedRuns,
  onClearSelection,
}: RunBulkActionsBarProps) => {
  const navigate = useNavigate();

  const canCompare = selectedRuns.length === 2;

  const handleCompare = () => {
    if (!canCompare) return;
    const [a, b] = selectedRuns;
    navigate({ to: APP_ROUTES.COMPARE, search: { a, b } });
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 transform rounded-lg border border-border bg-background p-4 shadow-lg z-50">
      <InlineStack gap="4" blockAlign="center">
        <Text size="sm" weight="semibold">
          {selectedRuns.length} {pluralize(selectedRuns.length, "run")} selected
        </Text>

        <InlineStack gap="2" blockAlign="center">
          <Button
            variant="default"
            size="sm"
            onClick={handleCompare}
            disabled={!canCompare}
            title={canCompare ? undefined : "Select exactly 2 runs to compare"}
            {...tracking("compare_runs.dashboard.compare_selected")}
          >
            <Icon name="GitCompare" />
            Compare
          </Button>

          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            <Icon name="X" />
          </Button>
        </InlineStack>
      </InlineStack>
    </div>
  );
};

export default RunBulkActionsBar;
