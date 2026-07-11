import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { KeyedDiffEntry } from "@/routes/v2/pages/CompareView/utils/comparePipelines";

import { DiffStatusBadge } from "./DiffStatusBadge";

function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

interface ValueLineProps {
  label: string;
  value: unknown;
}

function ValueLine({ label, value }: ValueLineProps) {
  return (
    <InlineStack gap="2" blockAlign="start" wrap="nowrap">
      <Text as="span" size="xs" tone="subdued" className="w-10 shrink-0">
        {label}
      </Text>
      <Text
        as="span"
        size="xs"
        className="font-mono break-all whitespace-pre-wrap"
      >
        {formatValue(value)}
      </Text>
    </InlineStack>
  );
}

interface FieldDiffRowProps {
  entry: KeyedDiffEntry<unknown>;
  labelA: string;
  labelB: string;
}

export function FieldDiffRow({ entry, labelA, labelB }: FieldDiffRowProps) {
  return (
    <BlockStack gap="1" className="rounded border border-border p-2">
      <InlineStack gap="2" blockAlign="center">
        <Text as="span" size="sm" weight="semibold" className="font-mono">
          {entry.key}
        </Text>
        <DiffStatusBadge status={entry.status} />
      </InlineStack>
      {entry.status !== "new" && <ValueLine label={labelA} value={entry.a} />}
      {entry.status !== "lost" && <ValueLine label={labelB} value={entry.b} />}
    </BlockStack>
  );
}
