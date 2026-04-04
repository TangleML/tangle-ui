import { autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import CodeSyntaxHighlighter from "@/components/shared/CodeViewer/CodeSyntaxHighlighter";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec } from "@/models/componentSpec";
import { serializeComponentSpecToText } from "@/models/componentSpec";
import { useUpgradeComponentsWindow } from "@/routes/v2/pages/Editor/components/UpgradeComponents/useUpgradeComponentsWindow";
import { ShorcutBadge } from "@/routes/v2/shared/components/ShorcutBadge";
import type { KeyConstant } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const DEBUG_PANEL_WINDOW_ID = "debug-panel";

interface StatItemProps {
  label: string;
  value: number | string;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <InlineStack blockAlign="center" className="justify-between py-1" gap="2">
      <Text size="xs" className="text-gray-500">
        {label}
      </Text>
      <Text size="xs" weight="semibold" className="font-mono text-gray-700">
        {value}
      </Text>
    </InlineStack>
  );
}

interface StatGroupProps {
  title: string;
  children: React.ReactNode;
}

function StatGroup({ title, children }: StatGroupProps) {
  return (
    <BlockStack gap="1">
      <Text
        size="xs"
        weight="semibold"
        className="uppercase tracking-wider text-blue-600"
      >
        {title}
      </Text>
      <BlockStack className="pl-2 border-l-2 border-gray-200">
        {children}
      </BlockStack>
    </BlockStack>
  );
}

function getSpecYaml(spec: ComponentSpec | null): string {
  if (!spec) return "null";
  try {
    return serializeComponentSpecToText(spec);
  } catch {
    return "Error serializing spec";
  }
}

interface SpecStats {
  name: string;
  inputs: number;
  outputs: number;
  tasks: number;
  arguments: number;
  annotations: number;
  bindings: number;
  hasSpec: string;
  hasTasks: string;
}

const EMPTY_STATS: SpecStats = {
  name: "—",
  inputs: 0,
  outputs: 0,
  tasks: 0,
  arguments: 0,
  annotations: 0,
  bindings: 0,
  hasSpec: "No",
  hasTasks: "No",
};

function computeSpecCounts(spec: ComponentSpec): SpecStats {
  return {
    name: spec.name ?? "—",
    inputs: spec.inputs.length,
    outputs: spec.outputs.length,
    tasks: spec.tasks.length,
    arguments: spec.tasks.reduce((acc, t) => acc + t.arguments.length, 0),
    annotations: spec.tasks.reduce((acc, t) => acc + t.annotations.length, 0),
    bindings: spec.bindings.length,
    hasSpec: "Yes",
    hasTasks: spec.tasks.length > 0 ? "Yes" : "No",
  };
}

function getSpecStats(spec: ComponentSpec | null): SpecStats {
  return spec ? computeSpecCounts(spec) : EMPTY_STATS;
}

function getSelectedInfo(
  selectedNodeId: string | null,
  selectedNodeType: string | null,
): string {
  return selectedNodeId ? `${selectedNodeType}: ${selectedNodeId}` : "None";
}

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
        <TabsTrigger value="stats">Stats</TabsTrigger>
        <TabsTrigger value="yaml">YAML</TabsTrigger>
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
                    <ShorcutBadge id={shortcut.id} />
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
      });
    }
  }, [windows]);
}

const PressedKeysList = function PressedKeysList() {
  const { keyboard } = useSharedStores();
  const [pressedKeys, setPressedKeys] = useState<KeyConstant[]>([]);
  useEffect(() => {
    return autorun(() => {
      setPressedKeys(keyboard.pressedKeys);
    });
  }, [keyboard]);

  return (
    <BlockStack>
      <Text
        size="xs"
        weight="semibold"
        className="uppercase tracking-wider text-blue-600"
      >
        Pressed Keys ({pressedKeys.length})
      </Text>
      <InlineStack gap="2" blockAlign="center">
        {pressedKeys.map((key) => (
          <Text key={key}>{key}</Text>
        ))}
      </InlineStack>
    </BlockStack>
  );
};
