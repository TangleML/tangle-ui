import { observer } from "mobx-react-lite";

import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import TangleSubmitter from "@/components/shared/Submitters/Tangle/TangleSubmitter";
import { Icon } from "@/components/ui/icon";
import { serializeComponentSpec } from "@/models/componentSpec";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { deepClone } from "@/utils/deepClone";

export const QuickRunButton = observer(function QuickRunButton() {
  const { navigation } = useSharedStores();
  const { isAuthorized } = useAwaitAuthorization();
  const rootSpec = navigation.rootSpec;
  const allIssues = rootSpec?.allValidationIssues ?? [];
  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const hasErrors = errorCount > 0;

  let legacySpec: ReturnType<typeof serializeComponentSpec> | undefined;
  try {
    legacySpec = rootSpec
      ? deepClone(serializeComponentSpec(rootSpec))
      : undefined;
  } catch {
    legacySpec = undefined;
  }

  const iconColor = hasErrors
    ? "text-red-400 hover:text-red-300"
    : "text-green-400 hover:text-green-300";

  const tooltip = hasErrors ? "Pipeline has validation errors" : "Submit Run";

  return (
    <>
      <TooltipButton
        tooltip={tooltip}
        className="hover:bg-transparent"
        disabled={hasErrors}
        onClick={triggerSubmitRun}
      >
        <Icon name="Play" className={`${iconColor} transition-colors`} />
      </TooltipButton>
      {legacySpec && isAuthorized && (
        <div data-quick-run className="sr-only">
          <TangleSubmitter
            componentSpec={legacySpec}
            isComponentTreeValid={rootSpec?.isValid}
            onlyFixableIssues={!hasErrors && allIssues.length > 0}
          />
        </div>
      )}
    </>
  );
});

export function triggerSubmitRun() {
  const btn = document.querySelector<HTMLButtonElement>(
    "[data-quick-run] button:first-of-type",
  );
  btn?.click();
}

export function triggerSubmitWithArguments() {
  const btn = document.querySelector<HTMLButtonElement>(
    '[data-quick-run] [data-testid="run-with-arguments-button"]',
  );
  btn?.click();
}
