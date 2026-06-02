import { Link, useParams } from "@tanstack/react-router";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";
import { CurrentPerformance } from "@/routes/tangent/components/detail/CurrentPerformance";
import { ResultsSection } from "@/routes/tangent/components/detail/ResultsSection";
import { ScenarioSection } from "@/routes/tangent/components/detail/ScenarioSection";
import { TangentAnalysis } from "@/routes/tangent/components/detail/TangentAnalysis";
import { OpportunityScoreRing } from "@/routes/tangent/components/OpportunityScoreRing";
import { RunStatusIndicator } from "@/routes/tangent/components/RunStatusIndicator";
import { ScenarioStatusBadge } from "@/routes/tangent/components/ScenarioStatusBadge";
import { useTangentPipeline } from "@/routes/tangent/hooks/useTangentPipeline";
import { getCreatorHandle } from "@/routes/tangent/labels";

export function TangentProjectDetailView() {
  const { runId = "" } = useParams({ strict: false });
  const { data: pipeline, isPending, isError } = useTangentPipeline(runId);

  const backLink = (
    <Link
      to={APP_ROUTES.TANGENT}
      className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
    >
      ← All projects
    </Link>
  );

  if (isPending) {
    return (
      <BlockStack gap="4">
        {backLink}
        <InlineStack gap="2" blockAlign="center">
          <Spinner size={18} />
          <Text size="sm" tone="subdued">
            Loading…
          </Text>
        </InlineStack>
      </BlockStack>
    );
  }

  if (isError || !pipeline) {
    return (
      <BlockStack gap="4">
        {backLink}
        <Paragraph size="sm" tone="critical">
          ⚠️ Could not load this pipeline
        </Paragraph>
      </BlockStack>
    );
  }

  const creator = getCreatorHandle(pipeline.ownerEmail);

  return (
    <BlockStack gap="6">
      <InlineStack
        align="space-between"
        blockAlign="center"
        wrap="wrap"
        gap="3"
      >
        {backLink}
        <InlineStack gap="3" blockAlign="center" wrap="wrap">
          <RunStatusIndicator status={pipeline.runStatus} />
          <Text size="sm" font="mono" tone="subdued">
            Run {pipeline.runId}
          </Text>
          {pipeline.oasisUrl && (
            <a
              href={pipeline.oasisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              View in Oasis
              <Icon name="ExternalLink" size="xs" />
            </a>
          )}
        </InlineStack>
      </InlineStack>

      <InlineStack align="space-between" blockAlign="start" wrap="wrap" gap="4">
        <BlockStack gap="2" className="min-w-0 flex-1">
          <InlineStack gap="3" blockAlign="center" wrap="wrap">
            <Heading level={1}>{pipeline.name}</Heading>
            <ScenarioStatusBadge status={pipeline.scenarioStatus} />
          </InlineStack>
          <Text size="sm" tone="subdued">
            {pipeline.metricName ? `${pipeline.metricName} · ` : ""}
            {pipeline.baselineValue !== undefined
              ? `Baseline: ${pipeline.baselineValue.toFixed(4)}`
              : "No baseline set"}
            {creator ? ` · ${creator}` : ""}
          </Text>
        </BlockStack>
        {pipeline.analyzing ? (
          <Spinner size={28} />
        ) : (
          <OpportunityScoreRing score={pipeline.opportunityScore} showLabel />
        )}
      </InlineStack>

      <CurrentPerformance pipeline={pipeline} />

      <TangentAnalysis pipeline={pipeline} />

      {pipeline.scenarioStatus === "results_available" && pipeline.results && (
        <ResultsSection results={pipeline.results} />
      )}

      <ScenarioSection ideas={pipeline.ideas} />
    </BlockStack>
  );
}
