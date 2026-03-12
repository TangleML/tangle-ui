import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import CodeSyntaxHighlighter from "@/components/shared/CodeViewer/CodeSyntaxHighlighter";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec } from "@/models/componentSpec";
import { JsonSerializer } from "@/models/componentSpec";
import { componentSpecToText } from "@/utils/yaml";

import { editorStore } from "../store/editorStore";
import { keyboardStore } from "../store/keyboardStore";
import { navigationStore } from "../store/navigationStore";
import { closeWindow, getWindowById, openWindow } from "../windows/windowStore";
import { ShorcutBadge } from "./ShorcutBadge";

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

/**
 * Helper to generate YAML from spec
 */
function getSpecYaml(spec: ComponentSpec | null): string {
  if (!spec) return "null";
  try {
    const serializer = new JsonSerializer();
    return componentSpecToText(
      serializer.serialize(spec) as Parameters<typeof componentSpecToText>[0],
    );
  } catch {
    return "Error serializing spec";
  }
}

/**
 * Debug panel content - displays stats and JSON representation of the spec.
 * Used within the Windows system.
 */
const DebugPanelContent = observer(function DebugPanelContent() {
  const spec = navigationStore.rootSpec;
  const specYaml = getSpecYaml(spec);

  const keybordShortcuts = [...keyboardStore.shortcuts.values()];

  const stats = {
    name: spec?.name ?? "—",
    inputs: spec?.inputs.length ?? 0,
    outputs: spec?.outputs.length ?? 0,
    tasks: spec?.tasks.length ?? 0,
    arguments:
      spec?.tasks.reduce((acc, task) => acc + task.arguments.length, 0) ?? 0,
    annotations:
      spec?.tasks.reduce((acc, task) => acc + task.annotations.length, 0) ?? 0,
    bindings: spec?.bindings.length ?? 0,
  };

  const selectedInfo = editorStore.selectedNodeId
    ? `${editorStore.selectedNodeType}: ${editorStore.selectedNodeId}`
    : "None";

  return (
    <Tabs defaultValue="stats" className="h-full flex flex-col">
      <TabsList className="mx-3 mt-2 shrink-0">
        <TabsTrigger value="stats">Stats</TabsTrigger>
        <TabsTrigger value="yaml">YAML</TabsTrigger>
      </TabsList>

      <TabsContent value="stats" className="flex-1 min-h-0 overflow-y-auto">
        <BlockStack gap="4" className="p-3">
          {/* Spec Info */}
          <StatGroup title="Spec">
            <StatItem label="Name" value={stats.name} />
          </StatGroup>

          {/* Selection Info */}
          <StatGroup title="Selection">
            <StatItem label="Selected" value={selectedInfo} />
          </StatGroup>

          {/* Graph Counts */}
          <StatGroup title="Graph Structure">
            <StatItem label="Inputs" value={stats.inputs} />
            <StatItem label="Outputs" value={stats.outputs} />
            <StatItem label="Tasks" value={stats.tasks} />
          </StatGroup>

          {/* Internal State */}
          <StatGroup title="Internal State">
            <StatItem label="Arguments" value={stats.arguments} />
            <StatItem label="Annotations" value={stats.annotations} />
            <StatItem label="Bindings" value={stats.bindings} />
          </StatGroup>

          {/* Memory/Debug Info */}
          <StatGroup title="Store State">
            <StatItem label="Has Spec" value={spec ? "Yes" : "No"} />
            <StatItem
              label="Has Tasks"
              value={spec?.tasks && spec.tasks.length > 0 ? "Yes" : "No"}
            />
          </StatGroup>

          <StatGroup title="Keyboard Shortcuts">
            <BlockStack>
              <BlockStack>
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
export function DebugPanel() {
  useEffect(() => {
    const existingWindow = getWindowById(DEBUG_PANEL_WINDOW_ID);
    if (!existingWindow) {
      openWindow(<DebugPanelContent />, {
        id: DEBUG_PANEL_WINDOW_ID,
        title: "Debug Panel",
        position: { x: 16, y: 16 },
        size: { width: 320, height: 420 },
        disabledActions: ["close"],
      });
    }

    return () => {
      closeWindow(DEBUG_PANEL_WINDOW_ID);
    };
  }, []);

  return null;
}
