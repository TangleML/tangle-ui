import { observer } from "mobx-react-lite";

import { IconButton } from "@/components/ui/patterns/icon-button";
import { useWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { tracking } from "@/utils/tracking";

export const WindowActions = observer(function WindowActions() {
  const { model } = useWindowContext();
  const chromeVariant = model.isDocked ? "ghost" : "chrome";

  return (
    <div
      className="shrink-0 flex items-center gap-0.5"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {!model.isActionDisabled("minimize") && model.isDocked && (
        <IconButton
          icon={model.isMinimized ? "ChevronDown" : "Minus"}
          size="xs"
          variant={chromeVariant}
          onClick={() => model.toggleMinimize()}
          aria-label={model.isMinimized ? "Expand" : "Minimize"}
          {...tracking("v2.shared_window.chrome.minimize", {
            placement: "docked",
          })}
        />
      )}

      {!model.isActionDisabled("maximize") && (
        <IconButton
          icon={model.isMaximized ? "Minimize2" : "Maximize2"}
          size="xs"
          variant={chromeVariant}
          onClick={() => model.toggleMaximize()}
          aria-label={model.isMaximized ? "Restore" : "Maximize"}
          {...tracking("v2.shared_window.chrome.maximize", {
            placement: model.isDocked ? "docked" : "floating",
          })}
        />
      )}

      {!model.isActionDisabled("hide") ? (
        <IconButton
          icon="X"
          size="xs"
          variant={chromeVariant}
          onClick={() => model.hide()}
          aria-label="Hide"
          {...tracking("v2.shared_window.chrome.hide", {
            placement: model.isDocked ? "docked" : "floating",
          })}
        />
      ) : !model.isActionDisabled("close") ? (
        <IconButton
          icon="X"
          size="xs"
          variant={chromeVariant}
          tone="critical"
          onClick={() => model.close()}
          aria-label="Close"
          {...tracking("v2.shared_window.chrome.close", {
            placement: model.isDocked ? "docked" : "floating",
          })}
        />
      ) : null}
    </div>
  );
});
