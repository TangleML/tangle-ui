import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { KeyedDiffEntry } from "@/routes/v2/pages/CompareView/utils/comparePipelines";

const MAX_SIDE_VALUES = 4;

function formatSideValue(value: unknown): string {
  if (value === undefined) return "(unset)";
  return typeof value === "string" ? value : JSON.stringify(value);
}

interface SideValuesProps {
  fields: KeyedDiffEntry<unknown>[];
  side: "a" | "b";
}

/**
 * Compact, single-line-per-field rendering of one run's values, used when the
 * graph is spotlighting run A or B so nodes show that side's actual values
 * instead of an aggregate "N fields changed" summary.
 */
export function SideValues({ fields, side }: SideValuesProps) {
  const shown = fields.slice(0, MAX_SIDE_VALUES);
  const remaining = fields.length - shown.length;

  return (
    <BlockStack gap="0" className="w-full">
      {shown.map((entry) => {
        const value = formatSideValue(side === "b" ? entry.b : entry.a);
        return (
          <Text
            key={entry.key}
            as="span"
            size="xs"
            tone="subdued"
            className="w-full truncate font-mono"
            title={`${entry.key}: ${value}`}
          >
            <span className="font-semibold">{entry.key}:</span> {value}
          </Text>
        );
      })}
      {remaining > 0 && (
        <Text as="span" size="xs" tone="subdued">
          +{remaining} more
        </Text>
      )}
    </BlockStack>
  );
}
