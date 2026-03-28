import { useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { closeWindow } from "@/routes/v2/shared/windows/windows.actions";

import { useTaskActions } from "../../store/actions/useTaskActions";
import { UpgradeCandidateDetail } from "./components/UpgradeCandidateDetail";
import { UpgradeCandidateRow } from "./components/UpgradeCandidateRow";
import { UpgradeEmptyState } from "./components/UpgradeEmptyState";
import { UpgradeFooter } from "./components/UpgradeFooter";
import { UpgradeHeader } from "./components/UpgradeHeader";
import { useMockUpgradeCandidates } from "./hooks/useMockUpgradeCandidates";
import { useSelectionSet } from "./hooks/useSelectionSet";
import { useUpgradePreviewOverlay } from "./hooks/useUpgradePreviewOverlay";
import { candidateHasIssues } from "./types";

const WINDOW_ID = "upgrade-components";
const DEFAULT_LEFT_PANEL_WIDTH = 340;

export function UpgradeComponentsContent() {
  const spec = useSpec();
  const candidates = useMockUpgradeCandidates(true);
  const { upgradeSelectedTasks } = useTaskActions();

  const candidateIds = candidates.map((c) => c.taskId);

  const { selection, allChecked, someChecked, toggle, toggleAll, selectedIds } =
    useSelectionSet(candidateIds);

  const selectedCandidates = candidates.filter((c) => selection.has(c.taskId));

  useUpgradePreviewOverlay(selectedCandidates);

  const [focusedId, setFocusedId] = useState<string | null>(null);

  const focusedCandidate = candidates.find((c) => c.taskId === focusedId);

  const handleUpgrade = () => {
    if (!spec || selectedCandidates.length === 0) return;
    upgradeSelectedTasks(spec, selectedCandidates);
    closeWindow(WINDOW_ID);
  };

  if (candidates.length === 0) return <UpgradeEmptyState />;

  const issueCount = candidates.filter(candidateHasIssues).length;

  return (
    <BlockStack className="h-full bg-white">
      <UpgradeHeader
        total={candidates.length}
        issueCount={issueCount}
        selectedCount={selectedIds.length}
        allChecked={allChecked}
        someChecked={someChecked}
        onToggleAll={toggleAll}
      />
      <Separator />
      <div
        className="flex flex-1 min-h-0 overflow-hidden"
        data-testid="upgrade-components-content-container"
      >
        <div
          className="relative shrink-0 border-r h-full"
          style={{ width: DEFAULT_LEFT_PANEL_WIDTH }}
        >
          <ScrollArea className="h-full">
            <BlockStack className="py-1">
              {candidates.map((candidate) => (
                <UpgradeCandidateRow
                  key={candidate.taskId}
                  candidate={candidate}
                  checked={selection.has(candidate.taskId)}
                  selected={candidate.taskId === focusedId}
                  onCheckedChange={(checked) =>
                    toggle(candidate.taskId, checked)
                  }
                  onSelect={() => setFocusedId(candidate.taskId)}
                />
              ))}
            </BlockStack>
          </ScrollArea>
          <VerticalResizeHandle side="right" minWidth={300} />
        </div>
        <div className="flex flex-col min-w-[280px] flex-1 h-full min-h-0">
          <UpgradeCandidateDetail candidate={focusedCandidate} />
        </div>
      </div>
      <Separator />
      <UpgradeFooter
        selectedCount={selectedCandidates.length}
        onUpgrade={handleUpgrade}
        onCancel={() => closeWindow(WINDOW_ID)}
      />
    </BlockStack>
  );
}
