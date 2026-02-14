import { useEffect } from "react";
import { useSnapshot } from "valtio";

import CodeSyntaxHighlighter from "@/components/shared/CodeViewer/CodeSyntaxHighlighter";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { componentSpecToText } from "@/utils/yaml";

import { editorStore } from "../store/editorStore";
import {
  closeWindow,
  getWindowById,
  hideWindow,
  openWindow,
} from "../windows/windowStore";

export const DEBUG_PANEL_WINDOW_ID = "debug-panel";

interface StatItemProps {
  label: string;
  value: number | string;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <InlineStack blockAlign="center" className="justify-between py-1">
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
 * Debug panel content - displays stats and JSON representation of the spec.
 * Used within the Windows system.
 */
export function DebugPanelContent() {
  const snap = useSnapshot(editorStore);

  // Collect stats from the spec
  const spec = snap.spec;

  // Derive JSON from the snapshot - React Compiler handles memoization
  const specYaml = (() => {
    if (!spec) return "null";
    try {
      return componentSpecToText(spec.toJson());
    } catch {
      return "Error serializing spec";
    }
  })();

  const stats = {
    name: spec?.name ?? "—",
    inputs: spec?.inputs.getAll().length ?? 0,
    outputs: spec?.outputs.getAll().length ?? 0,
    tasks: spec?.implementation?.tasks.getAll().length ?? 0,
    arguments:
      spec?.implementation?.tasks
        .getAll()
        .reduce((acc, task) => acc + task.arguments.getAll().length, 0) ?? 0,
    annotations:
      spec?.implementation?.tasks
        .getAll()
        .reduce((acc, task) => acc + task.annotations.getAll().length, 0) ?? 0,
    bindings: spec?.implementation?.bindings.getAll().length ?? 0,
  };

  const selectedInfo = snap.selectedNodeId
    ? `${snap.selectedNodeType}: ${snap.selectedNodeId}`
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
              label="Has Implementation"
              value={spec?.implementation ? "Yes" : "No"}
            />
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
}

/**
 * DebugPanel component that manages the debug panel window lifecycle.
 * The window is created but hidden by default - it appears in the TaskPanel
 * and can be restored from there.
 */
export function DebugPanel() {
  useEffect(() => {
    // Create the window but immediately hide it so it appears in TaskPanel
    const existingWindow = getWindowById(DEBUG_PANEL_WINDOW_ID);
    if (!existingWindow) {
      openWindow(<DebugPanelContent />, {
        id: DEBUG_PANEL_WINDOW_ID,
        title: "Debug Panel",
        position: { x: 16, y: 16 },
        size: { width: 320, height: 420 },
        disabledActions: ["close"],
      });
      // Hide it immediately so it starts in the TaskPanel
      hideWindow(DEBUG_PANEL_WINDOW_ID);
    }

    // Cleanup: close window on unmount
    return () => {
      closeWindow(DEBUG_PANEL_WINDOW_ID);
    };
  }, []);

  // This component doesn't render anything - it just manages the window lifecycle
  return null;
}
