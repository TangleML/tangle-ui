/**
 * HistoryContent - displays spec change history as a read-only audit trail.
 *
 * Shows a timeline of operations performed on the spec.
 * Undo functionality is not available in this version.
 */

import { useSnapshot } from "valtio";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { clearHistory, type HistoryEntry, historyStore } from "../store/historyStore";

interface HistoryEntryItemProps {
  entry: HistoryEntry;
  isLatest: boolean;
}

/**
 * Format timestamp into a readable time string.
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Individual history entry item (read-only).
 */
function HistoryEntryItem({ entry, isLatest }: HistoryEntryItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 px-3 py-2 rounded-md",
        isLatest ? "bg-blue-50 border border-blue-200" : "border border-transparent",
      )}
    >
      {/* Timeline indicator */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isLatest ? "bg-blue-500" : "bg-slate-300",
          )}
        />
        {!isLatest && <div className="w-px h-full bg-slate-200 mt-1" />}
      </div>

      {/* Content */}
      <BlockStack gap="0" className="min-w-0 flex-1">
        <Text
          size="sm"
          weight={isLatest ? "semibold" : "regular"}
          className={cn(
            "break-words",
            isLatest ? "text-blue-700" : "text-slate-700",
          )}
        >
          {entry.description}
          {isLatest && (
            <Text as="span" size="xs" className="text-blue-500 ml-2">
              (Current)
            </Text>
          )}
        </Text>
        <Text size="xs" tone="subdued">
          {formatTime(entry.timestamp)}
        </Text>
      </BlockStack>
    </div>
  );
}

export function HistoryContent() {
  const snap = useSnapshot(historyStore);

  const handleClear = () => {
    clearHistory();
  };

  // Reverse entries to show newest first
  const reversedEntries = [...snap.entries].reverse();
  const latestId = reversedEntries[0]?.id;

  if (snap.entries.length === 0) {
    return (
      <BlockStack
        gap="4"
        className="p-4 h-full items-center justify-center"
        align="center"
      >
        <Icon name="History" size="lg" className="text-slate-300" />
        <Text size="sm" tone="subdued" className="text-center">
          No history yet.
          <br />
          Changes will appear here.
        </Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="2" className="h-full">
      {/* Header with clear button */}
      <InlineStack
        gap="2"
        blockAlign="center"
        className="px-3 py-2 border-b border-slate-200 justify-between"
      >
        <Text size="xs" tone="subdued">
          {snap.entries.length} change{snap.entries.length !== 1 ? "s" : ""}
        </Text>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-slate-500 hover:text-red-500"
          onClick={handleClear}
          title="Clear history"
        >
          <Icon name="Trash2" size="xs" />
        </Button>
      </InlineStack>

      {/* History entries */}
      <BlockStack gap="1" className="flex-1 overflow-y-auto px-2 pb-2">
        {reversedEntries.map((entry) => (
          <HistoryEntryItem
            key={entry.id}
            entry={entry as HistoryEntry}
            isLatest={entry.id === latestId}
          />
        ))}
      </BlockStack>

      {/* Info text */}
      <div className="px-3 py-2 border-t border-slate-200">
        <Text size="xs" tone="subdued" className="text-center">
          History is read-only
        </Text>
      </div>
    </BlockStack>
  );
}
