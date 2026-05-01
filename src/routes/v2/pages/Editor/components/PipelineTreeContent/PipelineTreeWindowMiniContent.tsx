import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
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
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative size-8 shrink-0 rounded-md"
        aria-label="Pipeline Structure"
      >
        <Icon name="GitBranch" size="sm" className="text-gray-700" />
        {showValidBadge ? (
          <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-green-200">
            <Icon name="CircleCheck" size="xs" className="text-green-600" />
          </span>
        ) : null}
        {rootSpec && hasIssues ? (
          <span className="pointer-events-none absolute -top-1 -right-1">
            <IssueBadge issues={issues} />
          </span>
        ) : null}
      </Button>
    );
  },
);
