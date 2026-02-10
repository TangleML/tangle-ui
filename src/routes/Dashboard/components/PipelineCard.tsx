import { useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { EDITOR_PATH } from "@/routes/router";
import { isGraphImplementation } from "@/utils/componentSpec";
import type { ComponentFileEntry } from "@/utils/componentStore";
import { formatRelativeTime } from "@/utils/date";

export const PipelineCard = ({
  name,
  entry,
  showPinControls = false,
  pinned = false,
  onTogglePinned,
}: {
  name: string;
  entry: ComponentFileEntry;
  showPinControls?: boolean;
  pinned?: boolean;
  onTogglePinned?: (name: string) => void;
}) => {
  const navigate = useNavigate();
  const relativeTime = entry.modificationTime
    ? formatRelativeTime(entry.modificationTime)
    : null;

  const spec = entry.componentRef.spec;
  const description = spec?.description;
  const inputCount = spec?.inputs?.length ?? 0;
  const outputCount = spec?.outputs?.length ?? 0;

  const taskCount =
    spec?.implementation && isGraphImplementation(spec.implementation)
      ? Object.keys(spec.implementation.graph.tasks).length
      : 0;

  const openPipeline = () => {
    navigate({ to: `${EDITOR_PATH}/${encodeURIComponent(name)}` });
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPipeline();
    }
  };

  const handlePinnedToggle = () => {
    onTogglePinned?.(name);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPipeline}
      onKeyDown={onCardKeyDown}
      className="group flex w-full cursor-pointer items-start gap-3 rounded-xl border border-transparent bg-transparent px-3 py-2 text-left transition-all duration-200 ease-out hover:bg-violet-500/6 hover:shadow-[0_8px_20px_-12px_rgba(124,58,237,0.3)]"
    >
      <div className="mt-0.5 shrink-0 rounded-lg bg-primary/8 p-1.5 text-primary transition-colors group-hover:bg-primary/12">
        <Icon name="Workflow" size="sm" />
      </div>
      <BlockStack gap="0" className="min-w-0 flex-1 overflow-hidden">
        <Text
          as="p"
          size="sm"
          weight="semibold"
          className="truncate"
          title={name}
        >
          {name}
        </Text>
        {description && (
          <Text
            as="p"
            size="xs"
            tone="subdued"
            className="mt-0.5 truncate leading-tight"
            title={description}
          >
            {description}
          </Text>
        )}
        <InlineStack gap="3" blockAlign="center" className="mt-1">
          {taskCount > 0 && (
            <InlineStack gap="1" blockAlign="center" className="shrink-0">
              <Icon name="Layers" size="xs" />
              <Text as="span" size="xs" tone="subdued">
                {taskCount} tasks
              </Text>
            </InlineStack>
          )}
          {inputCount > 0 && (
            <InlineStack gap="1" blockAlign="center" className="shrink-0">
              <Icon name="ArrowDownToLine" size="xs" />
              <Text as="span" size="xs" tone="subdued">
                {inputCount} in
              </Text>
            </InlineStack>
          )}
          {outputCount > 0 && (
            <InlineStack gap="1" blockAlign="center" className="shrink-0">
              <Icon name="ArrowUpFromLine" size="xs" />
              <Text as="span" size="xs" tone="subdued">
                {outputCount} out
              </Text>
            </InlineStack>
          )}
          {relativeTime && (
            <Text
              as="span"
              size="xs"
              tone="subdued"
              className="ml-auto shrink-0 leading-none"
            >
              {relativeTime}
            </Text>
          )}
        </InlineStack>
      </BlockStack>
      {showPinControls && onTogglePinned && (
        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
              pinned && "text-violet-500",
            )}
            onClick={handlePinnedToggle}
            aria-label={pinned ? "Unpin pipeline" : "Pin pipeline"}
          >
            <Icon name={pinned ? "Pin" : "PinOff"} size="sm" />
          </Button>
        </div>
      )}
    </div>
  );
};
