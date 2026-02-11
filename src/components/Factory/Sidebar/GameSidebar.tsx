import { BlockStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { BOTTOM_FOOTER_HEIGHT, TOP_NAV_HEIGHT } from "@/utils/constants";

import Buildings from "./Buildings";
import Controls from "./Controls";
import Resources from "./Resources";

const MIN_WIDTH = 220;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 256;

const GameSidebar = () => {
  return (
    <div
      className="relative h-full bg-sidebar text-sidebar-foreground overflow-x-hidden overflow-y-auto"
      data-testid="flow-sidebar-container"
      style={{
        width: `${DEFAULT_WIDTH}px`,
        minWidth: `${MIN_WIDTH}px`,
        maxWidth: `${MAX_WIDTH}px`,
        maxHeight: `calc(100vh - ${TOP_NAV_HEIGHT}px - ${BOTTOM_FOOTER_HEIGHT}px)`,
      }}
    >
      <BlockStack fill gap="2" inlineAlign="start" className="p-4">
        <Controls />
        <Resources />
        <Buildings />
      </BlockStack>

      <VerticalResizeHandle
        side="right"
        minWidth={MIN_WIDTH}
        maxWidth={MAX_WIDTH}
      />
    </div>
  );
};

export default GameSidebar;
