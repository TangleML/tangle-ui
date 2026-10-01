import type { LayoutAlgorithm } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import type { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

/**
 * Laying out the canvas goes through the `auto-layout` shortcut rather than
 * dagre directly, because dagre needs React Flow's measured node sizes and
 * only the canvas has those. The shortcut reports back through `onLaidOut`, so
 * a canvas that is not mounted — or holds no nodes — returns false rather than
 * silently claiming to have arranged something.
 */
export function invokeAutoLayoutVia(keyboard: KeyboardStore) {
  return (algorithm?: LayoutAlgorithm) => {
    let laidOut = false;
    keyboard.invokeShortcut("auto-layout", {
      algorithm,
      onLaidOut: () => {
        laidOut = true;
      },
    });
    return laidOut;
  };
}
