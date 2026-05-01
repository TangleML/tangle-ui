import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import CodeSyntaxHighlighter from "@/components/shared/CodeViewer/CodeSyntaxHighlighter";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { useUpgradeComponentsWindow } from "@/routes/v2/pages/Editor/components/UpgradeComponents/useUpgradeComponentsWindow";
import { ShortcutBadge } from "@/routes/v2/shared/components/ShortcutBadge";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { getSelectedInfo, getSpecStats, getSpecYaml } from "./debugPanel.utils";
import { PressedKeysList } from "./PressedKeysList";
import { StatGroup, StatItem } from "./StatComponents";

const DEBUG_PANEL_WINDOW_ID = "debug-panel";

/**
 * Debug panel content - displays stats and JSON representation of the spec.
 * Used within the Windows system.
 */
const DebugPanelContent = observer(function DebugPanelContent() {
  const { editor, keyboard, navigation } = useSharedStores();
  const openUpgradeComponentsWindow = useUpgradeComponentsWindow();
  const spec = navigation.rootSpec;
  const specYaml = getSpecYaml(spec);
  const keybordShortcuts = [...keyboard.shortcuts.values()];
  const stats = getSpecStats(spec);
  const selectedInfo = getSelectedInfo(
    editor.selectedNodeId,
    editor.selectedNodeType,
  );

  return (
    <Tabs defaultValue="stats" className="h-full flex flex-col">
      <TabsList className="mx-3 mt-2 shrink-0">
        <TabsTrigger value="stats" className="text-xs!">
          Stats
        </TabsTrigger>
        <TabsTrigger value="yaml" className="text-xs!">
          YAML
        </TabsTrigger>
      </TabsList>

      <TabsContent value="stats" className="flex-1 min-h-0 overflow-y-auto">
        <BlockStack gap="4" className="p-3">
          <StatGroup title="Spec">
            <StatItem label="Name" value={stats.name} />
          </StatGroup>

          <StatGroup title="Selection">
            <StatItem label="Selected" value={selectedInfo} />
          </StatGroup>

          <StatGroup title="Graph Structure">
            <StatItem label="Inputs" value={stats.inputs} />
            <StatItem label="Outputs" value={stats.outputs} />
            <StatItem label="Tasks" value={stats.tasks} />
          </StatGroup>

          <StatGroup title="Internal State">
            <StatItem label="Arguments" value={stats.arguments} />
            <StatItem label="Annotations" value={stats.annotations} />
            <StatItem label="Bindings" value={stats.bindings} />
          </StatGroup>

          <StatGroup title="Store State">
            <StatItem label="Has Spec" value={stats.hasSpec} />
            <StatItem label="Has Tasks" value={stats.hasTasks} />
          </StatGroup>

          <StatGroup title="Actions">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={openUpgradeComponentsWindow}
            >
              <Icon name="CircleArrowUp" size="sm" />
              Upgrade Components
            </Button>
          </StatGroup>

          <StatGroup title="Keyboard Shortcuts">
            <BlockStack>
              <BlockStack>
                <PressedKeysList />
                <Separator />
                {keybordShortcuts.map((shortcut) => (
                  <InlineStack
                    key={shortcut.id}
                    gap="2"
                    blockAlign="center"
                    className="justify-between py-1"
                  >
                    <Text size="xs" key={shortcut.id}>
                      {shortcut.label}
                    </Text>
                    <ShortcutBadge id={shortcut.id} />
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          </StatGroup>
        </BlockStack>
      </TabsContent>

      <TabsContent value="yaml" className="flex-1 min-h-0">
        <div className="m-2 h-full rounded-md overflow-hidden bg-gray-50 border border-gray-200">
          <CodeSyntaxHighlighter code={specYaml} language="yaml" />
        </div>
      </TabsContent>
    </Tabs>
  );
});

/**
 * DebugPanel component that manages the debug panel window lifecycle.
 * If persisted as hidden, windowStore will auto-hide it.
 * Otherwise it starts visible (first-time default).
 */
export function useDebugPanelWindow() {
  const { windows } = useSharedStores();
  useEffect(() => {
    if (!windows.getWindowById(DEBUG_PANEL_WINDOW_ID)) {
      windows.openWindow(<DebugPanelContent />, {
        id: DEBUG_PANEL_WINDOW_ID,
        title: "Debug Panel",
        position: { x: 16, y: 16 },
        size: { width: 320, height: 420 },
        disabledActions: ["close"],
        persisted: true,
        defaultDockState: "left",
      });
    }
  }, [windows]);
}
