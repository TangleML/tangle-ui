import { useSnapshot } from "valtio";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { closeWindow, restoreWindow, windowStore } from "./windowStore";

/**
 * Bar that displays hidden windows. Rendered in normal flow above the editor
 * layout so it pushes content down when visible.
 */
export function TaskPanel() {
  const snap = useSnapshot(windowStore);

  const hiddenWindows = snap.windowOrder
    .map((id) => snap.windows[id])
    .filter((w) => w?.state === "hidden");

  if (hiddenWindows.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 bg-gray-100 border-b border-gray-300 shadow-sm">
      <InlineStack gap="1" className="px-2 py-1 overflow-x-auto">
        {hiddenWindows.map((window) => {
          const canClose = !window.disabledActions?.includes("close");
          return (
            <InlineStack
              key={window.id}
              blockAlign="center"
              gap="1"
              wrap="nowrap"
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded px-2 py-0.5 transition-colors cursor-pointer group shadow-sm"
            >
              <button
                onClick={() => restoreWindow(window.id)}
                className="flex items-center gap-1 min-w-0 h-5"
              >
                <Icon
                  name="AppWindow"
                  size="xs"
                  className="text-gray-500 shrink-0"
                />
                <Text
                  size="xs"
                  weight="semibold"
                  className="text-gray-700 truncate max-w-[120px]"
                >
                  {window.title}
                </Text>
              </button>
              {canClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-gray-400 hover:text-red-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWindow(window.id);
                  }}
                  title="Close"
                >
                  <Icon name="X" size="xs" />
                </Button>
              )}
            </InlineStack>
          );
        })}
      </InlineStack>
    </div>
  );
}
