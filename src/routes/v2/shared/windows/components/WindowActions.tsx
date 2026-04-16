import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";

const sharedButtonClassName =
  "h-5 w-5 text-gray-700 hover:text-gray-900 hover:bg-gray-200";

export const WindowActions = observer(function WindowActions() {
  const { model } = useWindowContext();

  return (
    <div
      className="shrink-0 flex items-center gap-0.5"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {!model.isActionDisabled("minimize") &&
        !(model.dockState === "right" && !model.isMinimized) && (
          <Button
            variant="ghost"
            size="icon"
            className={sharedButtonClassName}
            onClick={() => model.toggleMinimize()}
            aria-label={model.isMinimized ? "Expand" : "Minimize"}
          >
            <Icon
              name={model.isMinimized ? "ChevronDown" : "Minus"}
              size="xs"
            />
          </Button>
        )}

      {!model.isActionDisabled("maximize") && (
        <Button
          variant="ghost"
          size="icon"
          className={sharedButtonClassName}
          onClick={() => model.toggleMaximize()}
          aria-label={model.isMaximized ? "Restore" : "Maximize"}
        >
          <Icon
            name={model.isMaximized ? "Minimize2" : "Maximize2"}
            size="xs"
          />
        </Button>
      )}

      {!model.isActionDisabled("hide") ? (
        <Button
          variant="ghost"
          size="icon"
          className={sharedButtonClassName}
          onClick={() => model.hide()}
          aria-label="Hide"
        >
          <Icon name="X" size="xs" />
        </Button>
      ) : !model.isActionDisabled("close") ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-gray-500 hover:text-red-500 hover:bg-gray-300"
          onClick={() => model.close()}
          aria-label="Close"
        >
          <Icon name="X" size="xs" />
        </Button>
      ) : null}
    </div>
  );
});
