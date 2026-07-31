import { useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Switch } from "@/components/ui/switch";
import { Heading, Text } from "@/components/ui/typography";
import type { PipelineComparison } from "@/routes/v2/pages/CompareView/utils/comparePipelines";
import { tracking } from "@/utils/tracking";

import { IoDiffRow } from "./IoDiffRow";
import { TaskDiffRow } from "./TaskDiffRow";

interface SummaryCountProps {
  label: string;
  value: number;
}

function SummaryCount({ label, value }: SummaryCountProps) {
  return (
    <InlineStack gap="1" blockAlign="baseline">
      <Text as="span" size="sm" weight="semibold">
        {value}
      </Text>
      <Text as="span" size="sm" tone="subdued">
        {label}
      </Text>
    </InlineStack>
  );
}

interface StructuredDiffViewProps {
  comparison: PipelineComparison;
  labelA: string;
  labelB: string;
  nameA: string;
  nameB: string;
}

export function StructuredDiffView({
  comparison,
  labelA,
  labelB,
  nameA,
  nameB,
}: StructuredDiffViewProps) {
  const [showUnchanged, setShowUnchanged] = useState(false);

  if (!comparison.hasComparableGraph) {
    return (
      <InfoBox title="Nothing to compare" variant="info" width="full">
        Neither run has a graph pipeline, so there are no tasks, inputs, or
        outputs to align. Use the YAML tab to compare the raw specifications.
      </InfoBox>
    );
  }

  const { counts } = comparison;

  const visibleInputs = showUnchanged
    ? comparison.inputDiffs
    : comparison.inputDiffs.filter((diff) => diff.status !== "unchanged");
  const visibleOutputs = showUnchanged
    ? comparison.outputDiffs
    : comparison.outputDiffs.filter((diff) => diff.status !== "unchanged");
  const visibleTasks = showUnchanged
    ? comparison.taskDiffs
    : comparison.taskDiffs.filter(
        (diff) => diff.status !== "unchanged" || diff.outcomeChanged,
      );

  const nothingVisible =
    visibleInputs.length === 0 &&
    visibleOutputs.length === 0 &&
    visibleTasks.length === 0;

  return (
    <BlockStack gap="4" className="w-full">
      <InlineStack
        align="space-between"
        blockAlign="center"
        gap="4"
        className="w-full"
      >
        <InlineStack gap="4" blockAlign="center" wrap="wrap">
          <SummaryCount label="added" value={counts.added} />
          <SummaryCount label="removed" value={counts.removed} />
          <SummaryCount label="changed" value={counts.changed} />
          <SummaryCount label="unchanged" value={counts.unchanged} />
          {counts.outcomeChanged > 0 && (
            <InlineStack gap="1" blockAlign="center">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <Text as="span" size="sm" weight="semibold">
                {counts.outcomeChanged}
              </Text>
              <Text as="span" size="sm" tone="subdued">
                outcome differs
              </Text>
            </InlineStack>
          )}
        </InlineStack>
        <InlineStack gap="2" blockAlign="center" wrap="nowrap">
          <Switch
            id="compare-show-unchanged"
            checked={showUnchanged}
            onCheckedChange={setShowUnchanged}
            {...tracking("compare_runs.structured_diff.show_unchanged", {
              new_value: !showUnchanged,
            })}
          />
          <Label htmlFor="compare-show-unchanged">Show unchanged</Label>
        </InlineStack>
      </InlineStack>

      {nothingVisible ? (
        <InfoBox title="No differences" variant="success" width="full">
          These two runs have identical inputs, tasks, and outputs.
        </InfoBox>
      ) : (
        <BlockStack gap="5" className="w-full">
          {visibleInputs.length > 0 && (
            <DiffSection title="Inputs">
              {visibleInputs.map((diff) => (
                <IoDiffRow
                  key={diff.name}
                  diff={diff}
                  labelA={labelA}
                  labelB={labelB}
                />
              ))}
            </DiffSection>
          )}
          {visibleTasks.length > 0 && (
            <DiffSection title="Tasks">
              {visibleTasks.map((diff) => (
                <TaskDiffRow
                  key={diff.taskId}
                  diff={diff}
                  labelA={labelA}
                  labelB={labelB}
                  nameA={nameA}
                  nameB={nameB}
                />
              ))}
            </DiffSection>
          )}
          {visibleOutputs.length > 0 && (
            <DiffSection title="Outputs">
              {visibleOutputs.map((diff) => (
                <IoDiffRow
                  key={diff.name}
                  diff={diff}
                  labelA={labelA}
                  labelB={labelB}
                />
              ))}
            </DiffSection>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
}

interface DiffSectionProps {
  title: string;
  children: React.ReactNode;
}

function DiffSection({ title, children }: DiffSectionProps) {
  return (
    <BlockStack gap="2" className="w-full">
      <Heading level={3}>{title}</Heading>
      <BlockStack gap="2" className="w-full">
        {children}
      </BlockStack>
    </BlockStack>
  );
}
