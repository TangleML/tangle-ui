import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { WindowAction } from "@/routes/v2/shared/windows/types";

interface WindowActionsProps {
  windowId: string;
  isMinimized: boolean;
  isMaximized: boolean;
  isActionDisabled: (action: WindowAction) => boolean;
}

const sharedButtonClassName =
  "h-5 w-5 text-gray-500 hover:text-gray-700 hover:bg-gray-300";

export function WindowActions({
  windowId,
  isMinimized,
  isMaximized,
  isActionDisabled,
}: WindowActionsProps) {
  const { windows } = useSharedStores();
  return (
    <div
      className="shrink-0 flex items-center gap-0.5"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {!isActionDisabled("minimize") && (
        <Button
          variant="ghost"
          size="icon"
          className={sharedButtonClassName}
          onClick={() => windows.toggleMinimize(windowId)}
          title={isMinimized ? "Expand" : "Minimize"}
        >
          <Icon name={isMinimized ? "ChevronDown" : "Minus"} size="xs" />
        </Button>
      )}

      {!isActionDisabled("maximize") && (
        <Button
          variant="ghost"
          size="icon"
          className={sharedButtonClassName}
          onClick={() => windows.toggleMaximize(windowId)}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          <Icon name={isMaximized ? "Minimize2" : "Maximize2"} size="xs" />
        </Button>
      )}

      {!isActionDisabled("hide") && (
        <Button
          variant="ghost"
          size="icon"
          className={sharedButtonClassName}
          onClick={() => windows.hideWindow(windowId)}
          title="Hide to task panel"
        >
          <Icon name="PanelBottomClose" size="xs" />
        </Button>
      )}

      {!isActionDisabled("close") && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-gray-500 hover:text-red-500 hover:bg-gray-300"
          onClick={() => windows.closeWindow(windowId)}
          title="Close"
        >
          <Icon name="X" size="xs" />
        </Button>
      )}
    </div>
  );
}
