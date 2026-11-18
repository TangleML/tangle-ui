import { observer } from "mobx-react-lite";

import { FIND_PROJECT_CARD_SHORTCUT } from "@/routes/v2/pages/Tangent/hooks/useFindProjectCard";
import { PROJECT_CARD_WINDOW_ID } from "@/routes/v2/pages/Tangent/hooks/useTangentProjectWindows";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { DockPopover } from "@/routes/v2/shared/windows/DockPopover";

/**
 * The page's right dock, as a popover by the tab strip rather than a column:
 * a pipeline or run open beside it brings a rail of its own, and two rails side
 * by side read as one cluttered toolbar. Nothing starts here; it holds what's
 * dragged to the right.
 */
export const ProjectDockPopover = observer(function ProjectDockPopover() {
  const { windows } = useSharedStores();
  const cardIsHere =
    windows.getWindowById(PROJECT_CARD_WINDOW_ID)?.dockState === "right";

  return (
    <DockPopover
      side="right"
      icon="LayoutList"
      trackingId="projects.project_card.toggle"
      shortcutHint={cardIsHere ? FIND_PROJECT_CARD_SHORTCUT : undefined}
    />
  );
});
