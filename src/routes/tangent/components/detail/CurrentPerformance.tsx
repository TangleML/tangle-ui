import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { TangentPipeline } from "@/routes/tangent/types";

interface CurrentPerformanceProps {
  pipeline: TangentPipeline;
}

function PerformanceBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <BlockStack
      gap="1"
      className="flex-1 rounded-lg border border-border bg-background p-4"
    >
      <Text size="xs" tone="subdued">
        {label}
      </Text>
      {children}
    </BlockStack>
  );
}

export function CurrentPerformance({ pipeline }: CurrentPerformanceProps) {
  const hasMetric =
    pipeline.metricName !== undefined && pipeline.metricValue !== undefined;
  if (!pipeline.metricName) return null;

  const deltaPct = pipeline.metricDeltaPct;

  return (
    <InlineStack gap="4" wrap="wrap" className="w-full">
      <PerformanceBox label={`${pipeline.metricName} (current)`}>
        {hasMetric ? (
          <InlineStack gap="2" blockAlign="baseline" wrap="wrap">
            <Text size="lg" weight="bold">
              {pipeline.metricValue?.toFixed(4)}
            </Text>
            {deltaPct !== undefined && (
              <Text
                size="sm"
                weight="semibold"
                className={cn(
                  deltaPct >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive",
                )}
              >
                {deltaPct >= 0 ? "+" : ""}
                {deltaPct.toFixed(1)}% vs baseline
              </Text>
            )}
          </InlineStack>
        ) : (
          <Text size="sm" tone="subdued">
            last run had no result
          </Text>
        )}
      </PerformanceBox>

      <PerformanceBox label="Baseline">
        <Text size="lg" weight="bold">
          {pipeline.baselineValue !== undefined
            ? pipeline.baselineValue.toFixed(4)
            : "—"}
        </Text>
      </PerformanceBox>

      <PerformanceBox label="Opportunity Score">
        <Text size="lg" weight="bold">
          {pipeline.opportunityScore !== null
            ? `${pipeline.opportunityScore}/100`
            : "Not scored"}
        </Text>
      </PerformanceBox>
    </InlineStack>
  );
}
