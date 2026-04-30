import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";

const lightButtonClassName =
  "h-5 w-5 text-gray-700 hover:text-gray-900 hover:bg-white/50";
const darkButtonClassName =
  "h-5 w-5 text-gray-300 hover:text-white hover:bg-white/10";

const lightCloseButtonClassName =
  "h-5 w-5 text-gray-500 hover:text-red-500 hover:bg-gray-300";
const darkCloseButtonClassName =
  "h-5 w-5 text-gray-300 hover:text-red-400 hover:bg-white/10";

export const WindowActions = observer(function WindowActions() {
  const { model } = useWindowContext();
  const buttonClassName = model.isDocked
    ? lightButtonClassName
    : darkButtonClassName;
  const closeButtonClassName = model.isDocked
    ? lightCloseButtonClassName
    : darkCloseButtonClassName;

  return (
    <div
      className="shrink-0 flex items-center gap-0.5"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {!model.isActionDisabled("minimize") && model.isDocked && (
        <Button
          variant="ghost"
          size="icon"
          className={buttonClassName}
          onClick={() => model.toggleMinimize()}
          aria-label={model.isMinimized ? "Expand" : "Minimize"}
        >
          <Icon name={model.isMinimized ? "ChevronDown" : "Minus"} size="xs" />
        </Button>
      )}

      {!model.isActionDisabled("maximize") && (
        <Button
          variant="ghost"
          size="icon"
          className={buttonClassName}
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
          className={buttonClassName}
          onClick={() => model.hide()}
          aria-label="Hide"
        >
          <Icon name="X" size="xs" />
        </Button>
      ) : !model.isActionDisabled("close") ? (
        <Button
          variant="ghost"
          size="icon"
          className={closeButtonClassName}
          onClick={() => model.close()}
          aria-label="Close"
        >
          <Icon name="X" size="xs" />
        </Button>
      ) : null}
    </div>
  );
});
