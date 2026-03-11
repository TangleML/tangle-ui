import type { DragEvent } from "react";

import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export const ConduitSidebarItem = () => {
  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({ conduit: null }),
    );
    event.dataTransfer.setData(
      "DragStart.offset",
      JSON.stringify({
        offsetX: event.nativeEvent.offsetX,
        offsetY: event.nativeEvent.offsetY,
      }),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <li
      className="pl-2 py-1.5 cursor-grab hover:bg-gray-100 active:bg-gray-200"
      data-testid="conduit-sidebar-item"
      draggable
      onDragStart={onDragStart}
    >
      <InlineStack blockAlign="center" gap="2">
        <Icon name="RectangleHorizontal" className="text-gray-400 shrink-0" />
        <Text size="sm" className="truncate">
          Edge Conduit
        </Text>
      </InlineStack>
    </li>
  );
};
