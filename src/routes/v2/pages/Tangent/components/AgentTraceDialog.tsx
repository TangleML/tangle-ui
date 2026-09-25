import { useEffect, useState } from "react";

import type { AgentTraceEvent } from "@/agent/middleware/agentTrace";
import {
  clearAgentTraceLog,
  readAgentTraceLog,
} from "@/agent/middleware/agentTraceLog";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
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
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { copyToClipboard } from "@/utils/string";

const KIND_LABEL: Record<AgentTraceEvent["kind"], string> = {
  "turn-start": "turn",
  "turn-end": "turn",
  "tool-start": "call",
  "tool-end": "done",
  "tool-hung": "hung",
  thought: "",
  message: "",
};

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour12: false });
}

function asText(events: AgentTraceEvent[]): string {
  return events
    .map((event) =>
      [
        formatTime(event.at),
        event.agent,
        KIND_LABEL[event.kind],
        event.label,
        event.durationMs === undefined ? "" : `${event.durationMs}ms`,
        event.detail ?? "",
      ]
        .filter(Boolean)
        .join("  "),
    )
    .join("\n");
}

interface AgentTraceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AgentTraceDialog({ open, onOpenChange }: AgentTraceDialogProps) {
  const notify = useToastNotification();
  const [events, setEvents] = useState<AgentTraceEvent[]>([]);

  useEffect(() => {
    if (open) setEvents(readAgentTraceLog());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Agent log</DialogTitle>
          <DialogDescription>
            Every tool an agent called, with what it passed and what came back.
          </DialogDescription>
        </DialogHeader>

        <InlineStack gap="2" className="w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEvents(readAgentTraceLog())}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={events.length === 0}
            onClick={() => {
              copyToClipboard(asText(events));
              notify("Agent log copied", "success");
            }}
          >
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={events.length === 0}
            onClick={() => {
              clearAgentTraceLog();
              setEvents([]);
            }}
          >
            Clear
          </Button>
        </InlineStack>

        {events.length === 0 ? (
          <Text size="sm" tone="subdued">
            Nothing recorded yet. Ask an agent to change the pipeline, then
            reopen this.
          </Text>
        ) : (
          <BlockStack
            gap="1"
            className="min-h-0 flex-1 overflow-auto rounded-md border p-2 font-mono"
          >
            {events.map((event, index) => (
              <BlockStack key={`${event.at}-${index}`} gap="0">
                <InlineStack gap="2" className="w-full">
                  <Text size="xs" tone="subdued">
                    {formatTime(event.at)}
                  </Text>
                  <Text size="xs" tone="subdued">
                    {event.agent}
                  </Text>
                  <Text
                    size="xs"
                    tone={event.kind === "tool-hung" ? "critical" : "inherit"}
                    weight="semibold"
                  >
                    {KIND_LABEL[event.kind]} {event.label}
                  </Text>
                  {event.durationMs !== undefined && (
                    <Text size="xs" tone="subdued">
                      {event.durationMs}ms
                    </Text>
                  )}
                </InlineStack>
                {event.detail && (
                  <Text
                    size="xs"
                    tone="subdued"
                    className="break-words whitespace-pre-wrap"
                  >
                    {event.detail}
                  </Text>
                )}
              </BlockStack>
            ))}
          </BlockStack>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AgentTraceButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TooltipButton
        tooltip="View agent log"
        tooltipSide="bottom"
        tooltipAlign="end"
        aria-label="View agent log"
        variant="ghost"
        size="xs"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <Icon name="ScrollText" size="xs" />
      </TooltipButton>
      <AgentTraceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
