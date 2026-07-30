import { useState } from "react";

import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { KeyedDiffEntry } from "@/routes/v2/pages/CompareView/utils/comparePipelines";

import { DiffStatusBadge } from "./DiffStatusBadge";

function formatValue(value: unknown): string {
  if (value === undefined) return "(unset)";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

const LONG_VALUE_CHARS = 120;
const LONG_VALUE_LINES = 3;

interface ValueLineProps {
  label: string;
  value: unknown;
}

function ValueLine({ label, value }: ValueLineProps) {
  const [expanded, setExpanded] = useState(false);
  const text = formatValue(value);
  const isLong =
    text.length > LONG_VALUE_CHARS ||
    text.split("\n").length > LONG_VALUE_LINES;

  return (
    <InlineStack gap="2" blockAlign="start" wrap="nowrap">
      <Text as="span" size="xs" tone="subdued" className="w-10 shrink-0">
        {label}
      </Text>
      <BlockStack gap="0" className="min-w-0 flex-1">
        <Text
          as="span"
          size="xs"
          className={cn(
            "font-mono break-all whitespace-pre-wrap",
            isLong && !expanded && "line-clamp-3",
          )}
        >
          {text}
        </Text>
        {isLong && (
          <Button
            variant="link"
            size="sm"
            className="h-auto w-fit p-0 text-xs"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Show less" : "Show more"}
          </Button>
        )}
      </BlockStack>
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
