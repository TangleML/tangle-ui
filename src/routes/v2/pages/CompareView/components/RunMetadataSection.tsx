import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { KeyedDiffEntry } from "@/routes/v2/pages/CompareView/utils/comparePipelines";
import {
  buildRunMetadataComparison,
  type RunMetadataInput,
} from "@/routes/v2/pages/CompareView/utils/compareRunMetadata";
import { formatDate } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { DiffStatusBadge } from "./DiffStatusBadge";
import { FieldDiffRow } from "./FieldDiffRow";
import { RunTag } from "./RunTag";

interface RunMetadataSectionProps {
  a: RunMetadataInput;
  b: RunMetadataInput;
  labelA: string;
  labelB: string;
}

function scalarEntry(
  key: string,
  a: string | undefined,
  b: string | undefined,
  changed: boolean,
): KeyedDiffEntry<unknown> {
  return { key, a, b, status: changed ? "changed" : "unchanged" };
}

interface RunSummaryProps {
  run: "a" | "b";
  label: string;
  author: string | undefined;
  createdAt: string | undefined;
}

function RunSummary({ run, label, author, createdAt }: RunSummaryProps) {
  return (
    <InlineStack gap="2" blockAlign="center" wrap="nowrap" className="min-w-0">
      <RunTag run={run} label={label} />
      <Text as="span" size="xs" weight="semibold" className="truncate">
        {author ?? "Unknown author"}
      </Text>
      <Text as="span" size="xs" tone="subdued" className="whitespace-nowrap">
        {createdAt ? formatDate(createdAt) : "—"}
      </Text>
    </InlineStack>
  );
}

export function RunMetadataSection({
  a,
  b,
  labelA,
  labelB,
}: RunMetadataSectionProps) {
  const [open, setOpen] = useState(false);
  const comparison = buildRunMetadataComparison(a, b);

  const changedAnnotations = comparison.annotationDiffs.filter(
    (entry) => entry.status !== "unchanged",
  );
  const changedArguments = comparison.argumentDiffs.filter(
    (entry) => entry.status !== "unchanged",
  );

  const summary = (
    <InlineStack gap="4" wrap="wrap" blockAlign="center">
      <RunSummary
        run="a"
        label={labelA}
        author={comparison.author.a}
        createdAt={comparison.createdAt.a}
      />
      <RunSummary
        run="b"
        label={labelB}
        author={comparison.author.b}
        createdAt={comparison.createdAt.b}
      />
    </InlineStack>
  );

  if (!comparison.hasChanges) {
    return (
      <InlineStack
        gap="3"
        blockAlign="center"
        wrap="wrap"
        className="w-full rounded-lg border px-3 py-2"
      >
        <Text as="span" size="sm" weight="semibold">
          Run metadata
        </Text>
        {summary}
      </InlineStack>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="w-full rounded-lg border"
    >
      <CollapsibleTrigger
        className="flex w-full flex-wrap items-center gap-3 px-3 py-2"
        {...tracking("compare_runs.run_metadata.toggle")}
      >
        <InlineStack gap="2" blockAlign="center" wrap="nowrap">
          <Icon
            name="ChevronRight"
            size="sm"
            className={cn("transition-transform", open && "rotate-90")}
          />
          <Text as="span" size="sm" weight="semibold">
            Run metadata
          </Text>
          <InlineStack
            as="span"
            className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800"
          >
            <Text as="span" size="xs" weight="semibold">
              {comparison.changeCount} changed
            </Text>
          </InlineStack>
        </InlineStack>
        {summary}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <BlockStack gap="2" className="px-3 pb-3">
          <FieldDiffRow
            entry={scalarEntry(
              "author",
              comparison.author.a,
              comparison.author.b,
              comparison.author.changed,
            )}
            labelA={labelA}
            labelB={labelB}
          />
          <FieldDiffRow
            entry={scalarEntry(
              "created",
              comparison.createdAt.a,
              comparison.createdAt.b,
              comparison.createdAt.changed,
            )}
            labelA={labelA}
            labelB={labelB}
          />

          {changedAnnotations.length > 0 && (
            <BlockStack gap="1">
              <InlineStack gap="2" blockAlign="center">
                <Text as="span" size="xs" weight="semibold" tone="subdued">
                  Run annotations
                </Text>
                <DiffStatusBadge status="changed" />
              </InlineStack>
              {changedAnnotations.map((entry) => (
                <FieldDiffRow
                  key={entry.key}
                  entry={entry}
                  labelA={labelA}
                  labelB={labelB}
                />
              ))}
            </BlockStack>
          )}

          {changedArguments.length > 0 && (
            <BlockStack gap="1">
              <InlineStack gap="2" blockAlign="center">
                <Text as="span" size="xs" weight="semibold" tone="subdued">
                  Run arguments
                </Text>
                <DiffStatusBadge status="changed" />
              </InlineStack>
              {changedArguments.map((entry) => (
                <FieldDiffRow
                  key={entry.key}
                  entry={entry}
                  labelA={labelA}
                  labelB={labelB}
                />
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </CollapsibleContent>
    </Collapsible>
  );
}
