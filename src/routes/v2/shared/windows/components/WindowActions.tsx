import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";

const sharedButtonClassName =
  "h-5 w-5 text-gray-500 hover:text-gray-700 hover:bg-gray-300";

export const WindowActions = observer(function WindowActions() {
  const { model } = useWindowContext();

  return (
    <div
      className="shrink-0 flex items-center gap-0.5"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {!model.isActionDisabled("minimize") && (
        <Button
          variant="ghost"
          size="icon"
          className={sharedButtonClassName}
          onClick={() => model.toggleMinimize()}
          title={model.isMinimized ? "Expand" : "Minimize"}
        >
          <Icon name={model.isMinimized ? "ChevronDown" : "Minus"} size="xs" />
        </Button>
      )}

      {!model.isActionDisabled("maximize") && (
        <Button
          variant="ghost"
          size="icon"
          className={sharedButtonClassName}
          onClick={() => model.toggleMaximize()}
          title={model.isMaximized ? "Restore" : "Maximize"}
        >
          <Icon
            name={model.isMaximized ? "Minimize2" : "Maximize2"}
            size="xs"
          />
        </Button>
      )}

      {!model.isActionDisabled("hide") && (
        <Button
          variant="ghost"
          size="icon"
          className={sharedButtonClassName}
          onClick={() => model.hide()}
          title="Hide to task panel"
        >
          <Icon name="PanelBottomClose" size="xs" />
        </Button>
      )}

      {!model.isActionDisabled("close") && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-gray-500 hover:text-red-500 hover:bg-gray-300"
          onClick={() => model.close()}
          title="Close"
        >
          <Icon name="X" size="xs" />
        </Button>
      )}
    </div>
  );
});
