import { useEffect } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { ComponentSearchContent } from "@/routes/v2/pages/Editor/components/ComponentSearchContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const COMPONENT_SEARCH_WINDOW_ID = "component-search";

function ComponentSearchMiniContent() {
  return (
    <TooltipButton
      tooltip="Component Search"
      tooltipSide="right"
      variant="outline"
      size="icon"
      aria-label="Component Search"
    >
      <Icon name="Search" size="sm" className="text-muted-foreground" />
    </TooltipButton>
  );
}

export function useComponentSearchWindow() {
  const { windows } = useSharedStores();

  useEffect(() => {
    const existing = windows.getWindowById(COMPONENT_SEARCH_WINDOW_ID);
    if (existing) {
      existing.restore();
      existing.dock("left");
      return;
    }

    windows.openWindow(<ComponentSearchContent />, {
      id: COMPONENT_SEARCH_WINDOW_ID,
      title: "Component Search",
      position: { x: 0, y: 120 },
      size: { width: 300, height: 360 },
      disabledActions: ["close"],
      startVisible: true,
      persisted: true,
      defaultDockState: "left",
      miniContent: <ComponentSearchMiniContent />,
    });
  }, [windows]);
}
