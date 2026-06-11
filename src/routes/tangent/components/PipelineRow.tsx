import { useNavigate } from "@tanstack/react-router";
import type { MouseEvent } from "react";

import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { TableCell, TableRow } from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";
import { MetricDelta } from "@/routes/tangent/components/MetricDelta";
import { OpportunityScoreRing } from "@/routes/tangent/components/OpportunityScoreRing";
import { RunStatusIndicator } from "@/routes/tangent/components/RunStatusIndicator";
import { ScenarioStatusBadge } from "@/routes/tangent/components/ScenarioStatusBadge";
import { getCreatorHandle } from "@/routes/tangent/labels";
import type { TangentPipeline } from "@/routes/tangent/types";
import { formatRelativeTime } from "@/utils/date";

interface PipelineRowProps {
  pipeline: TangentPipeline;
}

export function PipelineRow({ pipeline }: PipelineRowProps) {
  const navigate = useNavigate();
  const creator = getCreatorHandle(pipeline.ownerEmail);
  const detailPath = `/tangent/${pipeline.runId}`;

  const handleRowClick = (event: MouseEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey) {
      window.open(detailPath, "_blank");
      return;
    }
    void navigate({
      to: APP_ROUTES.TANGENT_PROJECT,
      params: { runId: pipeline.runId },
    });
  };

  return (
    <TableRow onClick={handleRowClick} className="cursor-pointer h-12">
      <TableCell>
        <InlineStack gap="2" blockAlign="center" wrap="nowrap">
          <Text size="sm" weight="semibold" className="truncate max-w-80">
            {pipeline.name}
          </Text>
          <ScenarioStatusBadge status={pipeline.scenarioStatus} />
        </InlineStack>
      </TableCell>
      <TableCell>
        <RunStatusIndicator status={pipeline.runStatus} />
      </TableCell>
      <TableCell>
        <Text size="sm" tone="subdued">
          {formatRelativeTime(new Date(pipeline.lastRunAt))}
        </Text>
      </TableCell>
      <TableCell>
        {pipeline.metricName && pipeline.metricValue !== undefined ? (
          <InlineStack gap="2" blockAlign="center" wrap="nowrap">
            <Text size="sm">
              {pipeline.metricName}: {pipeline.metricValue.toFixed(4)}
            </Text>
            {pipeline.metricDeltaPct !== undefined && (
              <MetricDelta deltaPct={pipeline.metricDeltaPct} />
            )}
          </InlineStack>
        ) : (
          <Text size="sm" tone="subdued">
            —
          </Text>
        )}
      </TableCell>
      <TableCell>
        <Text size="sm" tone="subdued">
          {creator ?? "—"}
        </Text>
      </TableCell>
      <TableCell className="w-0">
        {pipeline.analyzing ? (
          <Spinner size={20} />
        ) : (
          <OpportunityScoreRing score={pipeline.opportunityScore} size={36} />
        )}
      </TableCell>
    </TableRow>
  );
}
