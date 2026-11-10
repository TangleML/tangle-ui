import { observer } from "mobx-react-lite";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import {
  useWindowContext,
  WindowContextProvider,
} from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { useWindowDrag } from "@/routes/v2/shared/windows/hooks/useWindowDrag";

import { FoldButton } from "./FoldButton";
import { WindowHeader } from "./WindowHeader";

/**
 * A window stacked in a dock popover. Opening something from its content
 * closes the popover, as it does from a collapsed dock's flyout.
 */
export const PopoverWindow = observer(function PopoverWindow({
  windowId,
  onDismiss,
}: {
  windowId: string;
  onDismiss: () => void;
}) {
  const { windows } = useSharedStores();
  const model = windows.getWindowById(windowId);
  if (!model || model.state === "hidden") return null;

  return (
    <WindowContextProvider
      value={{
        model,
        content: windows.getWindowContent(windowId),
        dismissFlyout: onDismiss,
      }}
    >
      <StackedWindow />
    </WindowContextProvider>
  );
});

/** Clicking the header folds it; dragging the header takes the window out. */
const StackedWindow = observer(function StackedWindow() {
  const { model, content } = useWindowContext();
  const { isDragging, panelRef, handleHeaderMouseDown } = useWindowDrag({
    docked: true,
  });

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label={model.title}
      data-window-id={model.id}
      className={cn(isDragging && "select-none opacity-50")}
    >
      <div
        className="group/window cursor-pointer bg-card"
        onClick={() => model.toggleMinimize()}
      >
        <WindowHeader
          title={model.title}
          isDragging={isDragging}
          onMouseDown={handleHeaderMouseDown}
          leadingIcon={
            <Icon
              name="GripVertical"
              size="xs"
              className="shrink-0 text-muted-foreground"
            />
          }
          actions={
            <FoldButton trackingId="v2.shared_window.dock_popover.fold" />
          }
          quiet
        />
      </div>
      {!model.isMinimized && content}
    </div>
  );
});
