import { useContextPanel } from "@/providers/ContextPanelProvider";
import { BOTTOM_FOOTER_HEIGHT, contentHeight } from "@/utils/constants";

export const ContextPanel = () => {
  const { content } = useContextPanel();
  return (
    <div
      data-testid="context-panel-container"
      className="h-full p-2 bg-sidebar text-sidebar-foreground overflow-y-auto"
      style={{
        maxHeight: contentHeight(BOTTOM_FOOTER_HEIGHT),
      }}
    >
      {content}
    </div>
  );
};
