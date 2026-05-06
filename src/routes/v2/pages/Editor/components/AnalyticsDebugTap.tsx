import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

const ANALYTICS_TRACK_EVENT = "tangle.analytics.track";
const MAX_ANALYTICS_EVENTS = 500;

interface AnalyticsDebugEntry {
  id: string;
  receivedAtIso: string;
  detail: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Listens for `tangle.analytics.track` (same as AnalyticsProvider) and shows a capped log for local debugging.
 */
export function AnalyticsDebugTap() {
  const [entries, setEntries] = useState<AnalyticsDebugEntry[]>([]);

  useEffect(() => {
    function handleTrack(ev: Event) {
      if (!(ev instanceof CustomEvent)) return;
      const raw = ev.detail;
      if (!isRecord(raw)) return;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const receivedAtIso = new Date().toISOString();

      setEntries((prev) => {
        const next: AnalyticsDebugEntry[] = [
          { id, receivedAtIso, detail: { ...raw } },
          ...prev,
        ];
        return next.slice(0, MAX_ANALYTICS_EVENTS);
      });
    }

    window.addEventListener(ANALYTICS_TRACK_EVENT, handleTrack);
    return () => {
      window.removeEventListener(ANALYTICS_TRACK_EVENT, handleTrack);
    };
  }, []);

  const handleClear = () => {
    setEntries([]);
  };

  const handleCopyRow = async (entry: AnalyticsDebugEntry) => {
    const text = JSON.stringify(
      { receivedAtIso: entry.receivedAtIso, ...entry.detail },
      null,
      2,
    );
    await navigator.clipboard.writeText(text);
  };

  return (
    <BlockStack gap="3" className="p-3 h-full min-h-0">
      <InlineStack gap="2" blockAlign="center" align="space-between">
        <Text size="xs" tone="subdued">
          Last {MAX_ANALYTICS_EVENTS} events (newest first)
        </Text>
        <Button type="button" variant="outline" size="xs" onClick={handleClear}>
          Clear
        </Button>
      </InlineStack>

      <BlockStack
        as="ul"
        gap="2"
        className="flex-1 min-h-0 overflow-y-auto list-none p-0 m-0"
      >
        {entries.length === 0 ? (
          <Text size="xs" tone="subdued">
            No analytics events yet. Interact with the app or open other tabs.
          </Text>
        ) : (
          entries.map((entry) => {
            const actionType =
              typeof entry.detail.actionType === "string"
                ? entry.detail.actionType
                : "(unknown)";
            return (
              <li
                key={entry.id}
                className="rounded-md border border-border bg-muted/40 p-2"
              >
                <BlockStack gap="1">
                  <InlineStack gap="2" blockAlign="start" align="space-between">
                    <Text size="xs" weight="semibold" className="break-all">
                      {actionType}
                    </Text>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="shrink-0"
                      onClick={() => void handleCopyRow(entry)}
                    >
                      Copy
                    </Button>
                  </InlineStack>
                  <Text size="xs" tone="subdued">
                    {entry.receivedAtIso}
                  </Text>
                  <pre className="text-[10px] leading-snug overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto rounded bg-background p-2 border border-border">
                    {JSON.stringify(entry.detail, null, 2)}
                  </pre>
                </BlockStack>
              </li>
            );
          })
        )}
      </BlockStack>
    </BlockStack>
  );
}
