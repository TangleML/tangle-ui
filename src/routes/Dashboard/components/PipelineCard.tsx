import { useNavigate } from "@tanstack/react-router";

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
}: {
  name: string;
  entry: ComponentFileEntry;
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

  return (
    <button
      onClick={() =>
        navigate({ to: `${EDITOR_PATH}/${encodeURIComponent(name)}` })
      }
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-200 ease-out cursor-pointer",
        "bg-transparent",
        "hover:bg-violet-500/6 hover:shadow-[0_8px_20px_-12px_rgba(124,58,237,0.3)]",
      )}
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
            className="mt-0.5 truncate"
            title={description}
          >
            {description}
          </Text>
        )}
        <InlineStack gap="3" blockAlign="center" className="mt-1.5">
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
              className="ml-auto shrink-0"
            >
              {relativeTime}
            </Text>
          )}
        </InlineStack>
      </BlockStack>
    </button>
  );
};
