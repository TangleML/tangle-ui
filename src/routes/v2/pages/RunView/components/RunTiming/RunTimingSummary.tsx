import { Card, CardContent } from "@/components/ui/card";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { formatTimingDuration } from "./runTiming";
import type { RunTimingMetrics } from "./runTiming.types";

interface TimingMetricProps {
  label: string;
  value: string;
  detail?: string;
}

function TimingMetric({ label, value, detail }: TimingMetricProps) {
  return (
    <Card className="min-w-0 gap-1 py-3 shadow-none">
      <CardContent className="px-4">
        <BlockStack gap="1">
          <Text size="xs" tone="subdued">
            {label}
          </Text>
          <Text size="lg" weight="semibold">
            {value}
          </Text>
          {detail && (
            <Text size="xs" tone="subdued">
              {detail}
            </Text>
          )}
        </BlockStack>
      </CardContent>
    </Card>
  );
}

export function RunTimingSummary({ metrics }: { metrics: RunTimingMetrics }) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <TimingMetric
        label="Wall-clock duration"
        value={formatTimingDuration(metrics.wallClockDurationMs)}
      />
      <TimingMetric label="Tasks" value={String(metrics.totalTaskCount)} />
      <TimingMetric
        label="Cached tasks"
        value={String(metrics.cachedTaskCount)}
      />
      <TimingMetric
        label="Average startup / queue"
        value={formatTimingDuration(metrics.averageStartupMs)}
        detail={
          metrics.startupCoverage > 0
            ? `${metrics.startupCoverage} tasks with startup timing`
            : undefined
        }
      />
      <TimingMetric
        label="Compute / busy"
        value={formatTimingDuration(metrics.busyRuntimeMs)}
        detail={`${metrics.busyPercent}% of wall clock`}
      />
      <TimingMetric
        label="Critical path estimate"
        value={formatTimingDuration(metrics.criticalPathDurationMs)}
      />
    </div>
  );
}
