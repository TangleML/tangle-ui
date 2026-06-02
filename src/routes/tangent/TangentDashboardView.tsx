import { useSearch } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { AnalyzeRunBlock } from "@/routes/tangent/components/AnalyzeRunBlock";
import { HeroBanner } from "@/routes/tangent/components/HeroBanner";
import { PipelineRow } from "@/routes/tangent/components/PipelineRow";
import { useReanalyzeAll } from "@/routes/tangent/hooks/useReanalyzeAll";
import { useTangentPipelines } from "@/routes/tangent/hooks/useTangentPipelines";
import { PIPELINE_FILTERS } from "@/routes/tangent/labels";
import type { PipelineFilter, TangentPipeline } from "@/routes/tangent/types";

interface TangentSearch {
  filter?: string;
}

function isPipelineFilter(value: unknown): value is PipelineFilter {
  return (
    typeof value === "string" && (PIPELINE_FILTERS as string[]).includes(value)
  );
}

function matchesFilter(
  pipeline: TangentPipeline,
  filter: PipelineFilter,
): boolean {
  if (filter === "my_pipelines") return pipeline.builtByCurrentUser;
  if (filter === "no_scenario")
    return pipeline.scenarioStatus === "no_scenario";
  if (filter === "has_results") {
    return pipeline.scenarioStatus === "results_available";
  }
  return true;
}

/** Sorts by opportunity score (highest first); unscored pipelines sink last. */
function byOpportunity(a: TangentPipeline, b: TangentPipeline): number {
  if (a.opportunityScore === null && b.opportunityScore === null) return 0;
  if (a.opportunityScore === null) return 1;
  if (b.opportunityScore === null) return -1;
  return b.opportunityScore - a.opportunityScore;
}

export function TangentDashboardView() {
  const search = useSearch({ strict: false }) as TangentSearch;
  const activeFilter: PipelineFilter = isPipelineFilter(search.filter)
    ? search.filter
    : "all";

  const { data: pipelines, isPending, isError } = useTangentPipelines();
  const reanalyze = useReanalyzeAll();

  const allPipelines = pipelines ?? [];
  const sorted = [...allPipelines].sort(byOpportunity);
  const visible = sorted.filter((pipeline) =>
    matchesFilter(pipeline, activeFilter),
  );
  const scoredCount = allPipelines.filter(
    (pipeline) => pipeline.opportunityScore !== null,
  ).length;

  const subtitle = isPending
    ? "Loading pipelines…"
    : `Ranked by Tangent improvement opportunity · Search team · ${allPipelines.length} pipelines · ${scoredCount} analyzed`;

  return (
    <BlockStack gap="6">
      <InlineStack
        align="space-between"
        blockAlign="center"
        wrap="wrap"
        gap="3"
      >
        <BlockStack gap="0">
          <Heading level={1}>Tangent</Heading>
          <Text size="sm" tone="subdued">
            Search Team
          </Text>
        </BlockStack>
        <Button
          variant="outline"
          size="sm"
          disabled={reanalyze.isPending}
          onClick={() => reanalyze.mutate()}
        >
          <Icon
            name="RefreshCw"
            size="sm"
            className={reanalyze.isPending ? "animate-spin" : undefined}
          />
          Re-analyze all
        </Button>
      </InlineStack>

      <HeroBanner />

      <AnalyzeRunBlock />

      <BlockStack gap="4">
        <BlockStack gap="1">
          <Heading level={2}>Pipelines</Heading>
          <Text size="sm" tone="subdued">
            {subtitle}
          </Text>
        </BlockStack>

        {isPending && (
          <InlineStack gap="2" blockAlign="center">
            <Spinner size={18} />
            <Text size="sm" tone="subdued">
              Loading…
            </Text>
          </InlineStack>
        )}

        {isError && (
          <Paragraph size="sm" tone="critical">
            ⚠️ Could not load pipelines
          </Paragraph>
        )}

        {!isPending && !isError && visible.length === 0 && (
          <Paragraph size="sm" tone="subdued">
            📭 No pipelines match this filter
          </Paragraph>
        )}

        {!isPending && !isError && visible.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-2/5">Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((pipeline) => (
                <PipelineRow key={pipeline.runId} pipeline={pipeline} />
              ))}
            </TableBody>
          </Table>
        )}
      </BlockStack>
    </BlockStack>
  );
}
