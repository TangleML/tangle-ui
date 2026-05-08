import { cva } from "class-variance-authority";
import { observer } from "mobx-react-lite";

import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import TangleSubmitter from "@/components/shared/Submitters/Tangle/TangleSubmitter";
import { Icon } from "@/components/ui/icon";
import { serializeComponentSpec } from "@/models/componentSpec";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { deepClone } from "@/utils/deepClone";
import { tracking } from "@/utils/tracking";

const quickRunIconVariants = cva("transition-colors", {
  variants: {
    hasErrors: { true: "", false: "" },
    onlyWarnings: { true: "", false: "" },
  },
  compoundVariants: [
    {
      hasErrors: false,
      onlyWarnings: false,
      className: "text-green-400 hover:text-green-300",
    },
    {
      hasErrors: false,
      onlyWarnings: true,
      className: "text-amber-400 hover:text-amber-300",
    },
    {
      hasErrors: true,
      className: "text-red-400 hover:text-red-300",
    },
  ],
  defaultVariants: {
    hasErrors: false,
    onlyWarnings: false,
  },
});

function tooltipLabel(hasErrors: boolean, onlyWarnings: boolean) {
  if (hasErrors) return "Pipeline has validation errors";
  if (onlyWarnings) return "Pipeline has validation warnings";
  return "Submit Run";
}

export const QuickRunButton = observer(function QuickRunButton() {
  const { navigation } = useSharedStores();
  const { isAuthorized } = useAwaitAuthorization();
  const rootSpec = navigation.rootSpec;
  const allIssues = rootSpec?.allValidationIssues ?? [];
  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const hasErrors = errorCount > 0;
  const onlyWarnings = allIssues.length > 0 && errorCount === 0;

  let legacySpec: ReturnType<typeof serializeComponentSpec> | undefined;
  try {
    legacySpec = rootSpec
      ? deepClone(serializeComponentSpec(rootSpec))
      : undefined;
  } catch {
    legacySpec = undefined;
  }

  const tooltip = tooltipLabel(hasErrors, onlyWarnings);

  return (
    <>
      <TooltipButton
        tooltip={tooltip}
        className="hover:bg-transparent"
        disabled={hasErrors}
        onClick={triggerSubmitRun}
        {...tracking("v2.pipeline_editor.quick_run")}
      >
        <Icon
          name="Play"
          className={quickRunIconVariants({ hasErrors, onlyWarnings })}
        />
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
