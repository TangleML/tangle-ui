import { cva } from "class-variance-authority";
import { observer } from "mobx-react-lite";
import type { ComponentProps, MouseEvent } from "react";

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
    variant: { menubar: "", mini: "" },
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
    variant: "menubar",
    hasErrors: false,
    onlyWarnings: false,
  },
});

function tooltipLabel(hasErrors: boolean, onlyWarnings: boolean) {
  if (hasErrors) return "Pipeline has validation errors";
  if (onlyWarnings) return "Pipeline has validation warnings";
  return "Submit Run";
}

interface QuickRunButtonProps {
  variant?: "menubar" | "mini";
  renderSubmitter?: boolean;
  trackingKey?: string;
}

export const QuickRunButton = observer(function QuickRunButton({
  variant = "menubar",
  renderSubmitter = true,
  trackingKey = "v2.pipeline_editor.quick_run",
  ...tooltipButtonProps
}: QuickRunButtonProps &
  Omit<ComponentProps<typeof TooltipButton>, "tooltip" | "variant" | "size">) {
  const { navigation } = useSharedStores();
  const { isAuthorized } = useAwaitAuthorization();
  const rootSpec = navigation.rootSpec;
  const allIssues = rootSpec?.allValidationIssues ?? [];
  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const hasErrors = errorCount > 0;
  const onlyWarnings = allIssues.length > 0 && errorCount === 0;

  let serializedPipelineSpec:
    ReturnType<typeof serializeComponentSpec> | undefined;
  try {
    serializedPipelineSpec = rootSpec
      ? deepClone(serializeComponentSpec(rootSpec))
      : undefined;
  } catch {
    serializedPipelineSpec = undefined;
  }

  const tooltip = tooltipLabel(hasErrors, onlyWarnings);
  const isMini = variant === "mini";

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isMini) event.stopPropagation();
    triggerSubmitRun();
  };

  return (
    <>
      <TooltipButton
        {...tooltipButtonProps}
        tooltip={tooltip}
        variant={isMini ? "outline" : undefined}
        size={isMini ? "icon" : undefined}
        className={
          isMini
            ? "relative size-8 shrink-0 rounded-md"
            : "hover:bg-transparent"
        }
        aria-label={isMini ? tooltip : undefined}
        disabled={hasErrors}
        onClick={handleClick}
        {...tracking(trackingKey)}
      >
        <Icon
          name="Play"
          size={isMini ? "sm" : undefined}
          className={quickRunIconVariants({ variant, hasErrors, onlyWarnings })}
        />
      </TooltipButton>
      {renderSubmitter && serializedPipelineSpec && isAuthorized && (
        <div data-quick-run className="sr-only">
          <TangleSubmitter
            componentSpec={serializedPipelineSpec}
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
