import { observer } from "mobx-react-lite";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import {
  countErrors,
  countWarnings,
} from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { IssueBadge } from "./components/IssueBadge";

export const PipelineTreeWindowMiniContent = observer(
  function PipelineTreeWindowMiniContent() {
    const { navigation } = useSharedStores();
    const rootSpec = navigation.rootSpec;
    const issues = rootSpec?.allValidationIssues ?? [];
    const errorCount = countErrors(issues);
    const warningCount = countWarnings(issues);
    const hasIssues = errorCount > 0 || warningCount > 0;
    const showValidBadge = rootSpec !== undefined && !hasIssues;

    return (
      <TooltipButton
        tooltip="View Pipeline Structure"
        tooltipSide="right"
        variant="outline"
        size="icon"
        className="relative"
        aria-label="Pipeline Structure"
      >
        <Icon name="GitBranch" size="sm" className="text-gray-700" />
        {showValidBadge && (
          <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-green-200">
            <Icon name="CircleCheck" size="xs" className="text-green-600" />
          </span>
        )}
        {rootSpec && hasIssues && (
          <span className="pointer-events-none absolute -top-1 -right-1">
            <IssueBadge issues={issues} />
          </span>
        )}
      </TooltipButton>
    );
  },
);
