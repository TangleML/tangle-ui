import GraphComponents from "@/components/shared/ReactFlow/FlowSidebar/sections/GraphComponents";
import { BlockStack } from "@/components/ui/layout";

/**
 * Wrapper component that renders the component library inside a Window.
 * GraphComponents is designed for the sidebar but works well in a window context
 * when rendered in "open" (expanded) mode.
 */
export function ComponentLibraryContent() {
  return (
    <BlockStack className="h-full overflow-y-auto">
      <GraphComponents isOpen />
    </BlockStack>
  );
}
