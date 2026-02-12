import { useRef, useState } from "react";
import { useSnapshot } from "valtio";
import { computed } from "valtio-reactive";

import CodeSyntaxHighlighter from "@/components/shared/CodeViewer/CodeSyntaxHighlighter";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { editorStore } from "../store/editorStore";

// Computed value that automatically updates when spec changes
const derivedState = computed({
  specJson: () => {
    // Access version to track spec mutations
    void editorStore.version;
    const spec = editorStore.spec;
    if (!spec) return "null";
    try {
      return JSON.stringify(spec.toJson(), null, 2);
    } catch {
      return "Error serializing spec";
    }
  },
});

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 420;

interface StatItemProps {
  label: string;
  value: number | string;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <InlineStack blockAlign="center" className="justify-between py-1">
      <Text size="xs" className="text-slate-400">
        {label}
      </Text>
      <Text size="xs" weight="semibold" className="font-mono text-slate-100">
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
      <Text size="xs" weight="semibold" className="uppercase tracking-wider text-amber-400">
        {title}
      </Text>
      <BlockStack className="pl-2 border-l-2 border-slate-600">{children}</BlockStack>
    </BlockStack>
  );
}

export function DebugPanel() {
  const snap = useSnapshot(editorStore);
  const derivedJson = useSnapshot(derivedState);

  // Access version to subscribe to spec changes
  void snap.version;

  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 16, y: 16 });
  const [size, setSize] = useState<Size>({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;

    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(MIN_WIDTH, startWidth + (e.clientX - startX));
      const newHeight = Math.max(MIN_HEIGHT, startHeight + (e.clientY - startY));
      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Calculate content height (total height minus header)
  const contentHeight = size.height - 44; // 44px is approximately the header height

  // Collect stats from the spec
  const spec = snap.spec;

  const stats = {
    name: spec?.name ?? "—",
    inputs: spec?.inputs.getAll().length ?? 0,
    outputs: spec?.outputs.getAll().length ?? 0,
    tasks: spec?.implementation?.tasks.getAll().length ?? 0,
    arguments: spec?.implementation?.tasks
      .getAll()
      .reduce((acc, task) => acc + task.arguments.getAll().length, 0) ?? 0,
    annotations: spec?.implementation?.tasks
      .getAll()
      .reduce((acc, task) => acc + task.annotations.getAll().length, 0) ?? 0,
    outputValues: spec?.implementation?.getOutputValues().length ?? 0,
  };

  const selectedInfo = snap.selectedNodeId
    ? `${snap.selectedNodeType}: ${snap.selectedNodeId}`
    : "None";


  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed z-50 rounded-lg shadow-xl border border-slate-700 overflow-hidden",
        "bg-slate-900/95 backdrop-blur-sm text-slate-100 flex flex-col",
        (isDragging || isResizing) && "select-none",
        isDragging && "cursor-grabbing",
      )}
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? "auto" : size.width,
        height: isMinimized ? "auto" : size.height,
        minWidth: MIN_WIDTH,
        minHeight: isMinimized ? "auto" : MIN_HEIGHT,
      }}
    >
      {/* Header - Draggable area */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 bg-slate-800/80",
          "cursor-grab border-b border-slate-700",
          isDragging && "cursor-grabbing",
        )}
        onMouseDown={handleMouseDown}
      >
        <InlineStack gap="2" blockAlign="center">
          <Icon name="Bug" size="sm" className="text-amber-400" />
          <Text size="sm" weight="semibold" className="text-slate-100">
            Debug Panel
          </Text>
        </InlineStack>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-slate-400 hover:text-slate-100 hover:bg-slate-700"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <Icon name={isMinimized ? "ChevronDown" : "ChevronUp"} size="sm" />
        </Button>
      </div>

      {/* Content */}
      {!isMinimized && (
        <Tabs defaultValue="stats" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="mx-3 mt-2 shrink-0">
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="flex-1 min-h-0">
            <div className="overflow-y-auto" style={{ maxHeight: contentHeight - 48 }}>
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
                  <StatItem label="Output Bindings" value={stats.outputValues} />
                </StatGroup>

                {/* Memory/Debug Info */}
                <StatGroup title="Store State">
                  <StatItem label="Has Spec" value={spec ? "Yes" : "No"} />
                  <StatItem label="Has Implementation" value={spec?.implementation ? "Yes" : "No"} />
                </StatGroup>
              </BlockStack>
            </div>
          </TabsContent>

          <TabsContent value="json" className="flex-1 min-h-0">
            <div
              className="m-2 rounded-md overflow-hidden bg-slate-900"
              style={{ height: contentHeight - 48 }}
            >
              <CodeSyntaxHighlighter code={derivedJson.specJson} language="json" />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Resize handle */}
      {!isMinimized && (
        <div
          className={cn(
            "absolute bottom-0 right-0 w-4 h-4 cursor-se-resize",
            "hover:bg-slate-600/50 rounded-tl-sm transition-colors",
          )}
          onMouseDown={handleResizeMouseDown}
        >
          <svg
            className="w-full h-full text-slate-500"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z" />
          </svg>
        </div>
      )}
    </div>
  );
}

