import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { useOptionalWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";

interface ToolPresentation {
  isRail: boolean;
  className: string;
  wrapperClassName: string;
  tooltipSide: "right" | "top";
}

interface ToolsPanelProps {
  layout?: "rail";
  children: (presentation: ToolPresentation) => ReactNode;
}

export const ToolsPanel = observer(function ToolsPanel({
  layout,
  children,
}: ToolsPanelProps) {
  const windowContext = useOptionalWindowContext();
  const isFloatingPanel =
    windowContext?.model.variant === "panel" &&
    windowContext.model.dockState === "none";

  if (layout === "rail") {
    return (
      <BlockStack gap="1" align="center" className="w-full">
        {children({
          isRail: true,
          className: "size-8 shrink-0 p-0",
          wrapperClassName: "w-fit",
          tooltipSide: "right",
        })}
      </BlockStack>
    );
  }

  const tools = children({
    isRail: false,
    className: isFloatingPanel
      ? "h-10 justify-start gap-3 px-3 shadow-none hover:border-border hover:bg-muted border"
      : "h-10 w-48 justify-start gap-3 border-transparent bg-transparent px-3 shadow-none hover:border-border hover:bg-muted",
    wrapperClassName: isFloatingPanel ? "shrink-0" : "w-fit",
    tooltipSide: "top",
  });

  return isFloatingPanel ? (
    <InlineStack
      gap="1"
      wrap="nowrap"
      blockAlign="center"
      className="p-2 bg-background rounded-md border"
    >
      {tools}
    </InlineStack>
  ) : (
    <BlockStack gap="1" className="p-2">
      {tools}
    </BlockStack>
  );
});
