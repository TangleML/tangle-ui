import yaml from "js-yaml";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import CodeSyntaxHighlighter from "@/components/shared/CodeViewer/CodeSyntaxHighlighter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { useUpgradeComponentsWindow } from "@/routes/v2/pages/Editor/components/UpgradeComponents/useUpgradeComponentsWindow";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import {
  readSystemClipboardInfo,
  type SystemClipboardInfo,
} from "@/routes/v2/shared/clipboard/clipboardEnvelope";
import { ShortcutBadge } from "@/routes/v2/shared/components/ShortcutBadge";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

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
  const { clipboard } = useEditorSession();
  const [clipboardDialogOpen, setClipboardDialogOpen] = useState(false);
  const [systemClipboard, setSystemClipboard] = useState<SystemClipboardInfo>({
    kind: "unavailable",
  });
  const openUpgradeComponentsWindow = useUpgradeComponentsWindow();

  const refreshSystemClipboard = async () => {
    setSystemClipboard(await readSystemClipboardInfo());
  };

  useEffect(() => {
    void refreshSystemClipboard();
  }, [clipboard.snapshots, clipboard.pasteOffsetIndex]);

  useEffect(() => {
    const handler = () => void refreshSystemClipboard();
    window.addEventListener("copy", handler);
    window.addEventListener("focus", handler);
    navigator.clipboard?.addEventListener?.("clipboardchange", handler);
    return () => {
      window.removeEventListener("copy", handler);
      window.removeEventListener("focus", handler);
      navigator.clipboard?.removeEventListener?.("clipboardchange", handler);
    };
  }, []);
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
        <TabsTrigger
          value="stats"
          className="text-xs!"
          {...tracking("v2.pipeline_editor.debug_panel.tab_stats")}
        >
          Stats
        </TabsTrigger>
        <TabsTrigger
          value="yaml"
          className="text-xs!"
          {...tracking("v2.pipeline_editor.debug_panel.tab_yaml")}
        >
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

          <StatGroup title="Clipboard">
            <StatItem
              label="Source"
              value={clipboardSourceLabel(systemClipboard)}
            />
            <StatItem
              label="Pastes since copy"
              value={clipboard.pasteOffsetIndex}
            />
            {systemClipboard.kind === "envelope" && (
              <ClipboardNodePreview
                snapshots={systemClipboard.envelope.snapshots}
                onViewAll={() => setClipboardDialogOpen(true)}
              />
            )}
            {systemClipboard.kind === "text" && (
              <ClipboardTextPreview
                text={systemClipboard.text}
                onViewAll={() => setClipboardDialogOpen(true)}
              />
            )}
            {systemClipboard.kind === "unavailable" && (
              <Text size="xs" tone="subdued" className="py-1">
                Click refresh to read clipboard
              </Text>
            )}
          </StatGroup>

          <Dialog
            open={clipboardDialogOpen}
            onOpenChange={setClipboardDialogOpen}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Clipboard contents</DialogTitle>
                <DialogDescription className="hidden">
                  {clipboardSourceLabel(systemClipboard)}
                </DialogDescription>
              </DialogHeader>
              {systemClipboard.kind === "envelope" && (
                <BlockStack gap="3">
                  <InlineStack gap="4">
                    <Text size="xs" tone="subdued">
                      Nodes:{" "}
                      <Text as="span" font="mono" weight="semibold">
                        {systemClipboard.envelope.snapshots.length}
                      </Text>
                    </Text>
                    <Text size="xs" tone="subdued">
                      Connections:{" "}
                      <Text as="span" font="mono" weight="semibold">
                        {systemClipboard.envelope.bindings.length}
                      </Text>
                    </Text>
                  </InlineStack>
                  <div className="flex flex-col h-[60vh] rounded-md overflow-hidden w-full bg-gray-50 border border-gray-200">
                    <div className="flex-1 relative">
                      <div className="absolute inset-0">
                        <CodeSyntaxHighlighter
                          code={yaml.dump(
                            {
                              snapshots: systemClipboard.envelope.snapshots,
                              bindings: systemClipboard.envelope.bindings,
                            },
                            { lineWidth: -1, noRefs: true, indent: 2 },
                          )}
                          language="yaml"
                        />
                      </div>
                    </div>
                  </div>
                </BlockStack>
              )}
              {systemClipboard.kind === "text" && (
                <pre className="max-h-96 overflow-auto rounded-md bg-gray-50 border border-gray-200 p-3 text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
                  {systemClipboard.text}
                </pre>
              )}
            </DialogContent>
          </Dialog>

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
              {...tracking("v2.pipeline_editor.debug_panel.upgrade_components")}
              onClick={() => openUpgradeComponentsWindow({ useMock: true })}
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
        <div className="m-2 h-full min-h-75 rounded-md overflow-hidden bg-gray-50 border border-gray-200 relative">
          <div className="absolute inset-0">
            <CodeSyntaxHighlighter code={specYaml} language="yaml" />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
});

function clipboardSourceLabel(info: SystemClipboardInfo): string {
  switch (info.kind) {
    case "envelope":
      return `nodes (${info.envelope.snapshots.length})`;
    case "text":
      return "text";
    case "empty":
      return "empty";
    case "unavailable":
      return "unavailable";
  }
}

const PREVIEW_NODE_LIMIT = 2;
const PREVIEW_TEXT_MAX_CHARS = 160;

function ClipboardNodePreview({
  snapshots,
  onViewAll,
}: {
  snapshots: { entityId: string; $type: string; name: string }[];
  onViewAll: () => void;
}) {
  if (snapshots.length === 0) return null;
  const visible = snapshots.slice(0, PREVIEW_NODE_LIMIT);
  const remaining = snapshots.length - visible.length;
  return (
    <BlockStack gap="1" className="pt-1">
      <BlockStack gap="0">
        {visible.map((s) => (
          <Text
            key={s.entityId}
            size="xs"
            font="mono"
            tone="subdued"
            className="truncate"
          >
            {s.$type}: {s.name}
          </Text>
        ))}
      </BlockStack>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 h-6 px-1"
        onClick={onViewAll}
        {...tracking("v2.pipeline_editor.debug_panel.clipboard_view_all")}
      >
        <Icon name="Maximize2" size="xs" />
        <Text size="xs">
          {remaining > 0
            ? `View all (${snapshots.length})`
            : "View full details"}
        </Text>
      </Button>
    </BlockStack>
  );
}

function ClipboardTextPreview({
  text,
  onViewAll,
}: {
  text: string;
  onViewAll: () => void;
}) {
  const trimmed = text.length > PREVIEW_TEXT_MAX_CHARS;
  const preview = trimmed ? `${text.slice(0, PREVIEW_TEXT_MAX_CHARS)}…` : text;
  return (
    <BlockStack gap="1" className="pt-1">
      <Text
        size="xs"
        font="mono"
        tone="subdued"
        className="line-clamp-2 break-all whitespace-pre-wrap"
      >
        {preview}
      </Text>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 h-6 px-1"
        onClick={onViewAll}
        {...tracking("v2.pipeline_editor.debug_panel.clipboard_view_all")}
      >
        <Icon name="Maximize2" size="xs" />
        <Text size="xs">View full text</Text>
      </Button>
    </BlockStack>
  );
}

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
