import { useEffect } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { ComponentSearchV2Content } from "@/routes/v2/pages/Editor/components/ComponentSearchV2Content";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const COMPONENT_SEARCH_V2_WINDOW_ID = "component-search-v2";

function ComponentSearchV2MiniContent() {
  return (
    <TooltipButton
      tooltip="Component Search"
      tooltipSide="right"
      variant="outline"
      size="icon"
      aria-label="Component Search"
    >
      <Icon name="Search" size="sm" className="text-gray-700" />
    </TooltipButton>
  );
}

export function useComponentSearchV2Window(enabled: boolean) {
  const { windows } = useSharedStores();

  useEffect(() => {
    if (!enabled) return;

    const existing = windows.getWindowById(COMPONENT_SEARCH_V2_WINDOW_ID);
    if (existing) {
      existing.restore();
      existing.dock("left");
      return;
    }

    windows.openWindow(<ComponentSearchV2Content />, {
      id: COMPONENT_SEARCH_V2_WINDOW_ID,
      title: "Component Search",
      position: { x: 0, y: 120 },
      size: { width: 300, height: 360 },
      disabledActions: ["close"],
      startVisible: true,
      persisted: true,
      defaultDockState: "left",
      miniContent: <ComponentSearchV2MiniContent />,
    });
  }, [enabled, windows]);
}
