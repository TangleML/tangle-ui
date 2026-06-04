import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type {
  ComponentSearchSource,
  IndexEntry,
} from "@/services/componentSearchIndex";
import { tracking } from "@/utils/tracking";

const SOURCE_ICON_TONE_BY_KIND: Record<ComponentSearchSource["kind"], string> =
  {
    standard: "text-blue-500",
    published: "text-emerald-500",
    registered: "text-violet-500",
    user: "text-amber-500",
  };

const SOURCE_FILTER_LABEL_BY_KIND: Record<
  ComponentSearchSource["kind"],
  string
> = {
  standard: "Standard",
  published: "Published",
  registered: "Registered libraries",
  user: "User generated",
};

export interface SourceFilterOption {
  source: ComponentSearchSource;
  count: number;
}

function sourceFilterKey(source: ComponentSearchSource): string {
  return source.kind;
}

/**
 * Filter state is keyed by source kind so multiple registered libraries behave
 * as one source category instead of several per-library toggles.
 */
export function createSourceFilterOptions(
  index: IndexEntry[],
): SourceFilterOption[] {
  const optionsByKey = new Map<string, SourceFilterOption>();

  for (const entry of index) {
    const key = sourceFilterKey(entry.source);
    const option = optionsByKey.get(key);
    if (option) {
      option.count += 1;
    } else {
      optionsByKey.set(key, {
        source: {
          kind: entry.source.kind,
          id: entry.source.kind,
          label: SOURCE_FILTER_LABEL_BY_KIND[entry.source.kind],
        },
        count: 1,
      });
    }
  }

  return Array.from(optionsByKey.values());
}

/** Apply source-type filter state to indexed component results. */
export function filterIndexByDisabledSourceKeys(
  index: IndexEntry[],
  disabledSourceKeys: string[],
): IndexEntry[] {
  const disabled = new Set(disabledSourceKeys);
  return index.filter((entry) => !disabled.has(sourceFilterKey(entry.source)));
}

interface SourceFilterBarProps {
  options: SourceFilterOption[];
  disabledSourceKeys: string[];
  onToggle: (sourceKey: string) => void;
  onEnableAll: () => void;
}

export const SourceFilterBar = ({
  options,
  disabledSourceKeys,
  onToggle,
  onEnableAll,
}: SourceFilterBarProps) => {
  const disabled = new Set(disabledSourceKeys);
  const activeCount = options.filter(
    (option) => !disabled.has(sourceFilterKey(option.source)),
  ).length;

  if (options.length <= 1 && activeCount === options.length) return null;

  return (
    <BlockStack gap="2">
      <InlineStack gap="2" blockAlign="center" wrap="wrap">
        <Text size="xs" tone="subdued">
          Sources
        </Text>
        {options.map(({ source, count }) => {
          const key = sourceFilterKey(source);
          const active = !disabled.has(key);
          return (
            <Button
              key={key}
              type="button"
              size="xs"
              variant={active ? "secondary" : "outline"}
              aria-pressed={active}
              aria-label={`${source.label} source (${count} component${count === 1 ? "" : "s"})`}
              onClick={() => onToggle(key)}
              className={cn(!active && "opacity-60")}
              {...tracking("component_library.source_filter", {
                source_kind: source.kind,
                enabled_after_click: !active,
              })}
            >
              <Icon
                name="Package"
                size="sm"
                className={SOURCE_ICON_TONE_BY_KIND[source.kind]}
              />
              {source.label}
              <Text as="span" size="xs" tone="subdued">
                {count}
              </Text>
            </Button>
          );
        })}
        {activeCount < options.length && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={onEnableAll}
            {...tracking("component_library.source_filter.show_all_button")}
          >
            Show all
          </Button>
        )}
      </InlineStack>
      {activeCount === 0 && (
        <Paragraph size="xs" tone="subdued">
          No sources selected. Turn on at least one source to show components.
        </Paragraph>
      )}
    </BlockStack>
  );
};
