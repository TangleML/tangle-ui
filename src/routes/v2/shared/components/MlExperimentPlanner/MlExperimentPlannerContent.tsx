import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Paragraph, Text } from "@/components/ui/typography";
import { useResearchProgress } from "@/routes/tangent/hooks/useResearchProgress";
import { useRunAutomatedResearch } from "@/routes/tangent/hooks/useRunAutomatedResearch";
import { useRunScenarios } from "@/routes/tangent/hooks/useRunScenarios";
import type {
  ScenarioEntry,
  ScenarioIdea,
  ScenarioIdeaType,
  ScenarioImpact,
} from "@/routes/tangent/idb/tangentDb";
import { ResearchProgressView } from "@/routes/v2/shared/components/MlExperimentPlanner/components/ResearchProgressView";

const IDEA_TYPE_LABEL: Record<ScenarioIdeaType, string> = {
  feature_engineering: "Feature engineering",
  hyperparameter_optimization: "Hyperparameter optimization",
  input_data: "Input data",
  model_architecture: "Model architecture",
};

type BadgeVariant = "default" | "secondary" | "outline";

const IMPACT_VARIANT: Record<ScenarioImpact, BadgeVariant> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

function scoreVariant(score: number): BadgeVariant {
  if (score >= 70) return "default";
  if (score >= 40) return "secondary";
  return "outline";
}

function formatCreatedAt(createdAt: number): string {
  return new Date(createdAt).toLocaleString();
}

function IdeaRow({ idea }: { idea: ScenarioIdea }) {
  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-4">
        <CardTitle>
          <Text as="span" size="sm" weight="semibold">
            {idea.title}
          </Text>
        </CardTitle>
        <InlineStack gap="1">
          <Badge variant="outline" size="sm" shape="rounded">
            {IDEA_TYPE_LABEL[idea.ideaType]}
          </Badge>
          <Badge
            variant={IMPACT_VARIANT[idea.impact]}
            size="sm"
            shape="rounded"
          >
            {idea.impact} impact
          </Badge>
        </InlineStack>
      </CardHeader>
      <CardContent className="px-4">
        <Text as="p" size="sm" tone="subdued">
          {idea.evidence}
        </Text>
      </CardContent>
    </Card>
  );
}

interface ScenarioRowProps {
  scenario: ScenarioEntry;
  onSelect: () => void;
  onRunResearch: () => void;
  isResearchPending: boolean;
}

function ScenarioRow({
  scenario,
  onSelect,
  onRunResearch,
  isResearchPending,
}: ScenarioRowProps) {
  const {
    data: progress,
    isLoading: isProgressLoading,
    isError,
  } = useResearchProgress(scenario.research);

  return (
    <TableRow className="cursor-pointer" onClick={onSelect}>
      <TableCell>
        <Badge variant={scoreVariant(scenario.score)} shape="rounded">
          {scenario.score}/100
        </Badge>
      </TableCell>
      <TableCell className="whitespace-normal">
        <Text as="span" size="sm" weight="semibold">
          {scenario.plan.name}
        </Text>
      </TableCell>
      <TableCell>
        <Text as="span" size="sm" tone="subdued">
          {scenario.ideas.length}
        </Text>
      </TableCell>
      <TableCell>
        <Text as="span" size="xs" tone="subdued">
          {formatCreatedAt(scenario.createdAt)}
        </Text>
      </TableCell>
      <TableCell>
        {scenario.research ? (
          <BlockStack gap="2" inlineAlign="start">
            <ResearchProgressView
              progress={progress}
              isLoading={isProgressLoading}
              isError={isError}
            />
            <Link
              external
              href={scenario.research.url}
              size="sm"
              onClick={(event) => event.stopPropagation()}
            >
              Open research session
            </Link>
          </BlockStack>
        ) : (
          <Button
            size="xs"
            variant="outline"
            disabled={isResearchPending}
            onClick={(event) => {
              event.stopPropagation();
              onRunResearch();
            }}
          >
            Run automated research
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

interface ScenarioDetailProps {
  scenario: ScenarioEntry;
  onBack: () => void;
  onRunResearch: () => void;
  isResearchPending: boolean;
}

function ScenarioDetail({
  scenario,
  onBack,
  onRunResearch,
  isResearchPending,
}: ScenarioDetailProps) {
  const {
    data: progress,
    isLoading: isProgressLoading,
    isError,
  } = useResearchProgress(scenario.research);

  return (
    <BlockStack gap="3" fill className="p-3" inlineAlign="start">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button type="button" onClick={onBack}>
                Experiments
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{scenario.plan.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <ScrollArea className="h-full w-full">
        <BlockStack gap="3">
          <InlineStack gap="2" blockAlign="center">
            <Badge variant={scoreVariant(scenario.score)} shape="rounded">
              {scenario.score}/100
            </Badge>
            <Text as="span" size="md" weight="semibold">
              {scenario.plan.name}
            </Text>
          </InlineStack>
          {scenario.research ? (
            <BlockStack gap="2" inlineAlign="start">
              <ResearchProgressView
                progress={progress}
                isLoading={isProgressLoading}
                isError={isError}
              />
              <Link external href={scenario.research.url} size="sm">
                Open research session
              </Link>
            </BlockStack>
          ) : (
            <Button
              size="sm"
              disabled={isResearchPending}
              onClick={onRunResearch}
            >
              Run automated research
            </Button>
          )}
          <Text as="p" size="sm" tone="subdued">
            {scenario.rationale}
          </Text>
          <Paragraph size="sm" className="whitespace-pre-line leading-relaxed">
            {scenario.summary}
          </Paragraph>
          {scenario.ideas.length > 0 && (
            <BlockStack gap="2">
              <Text as="span" size="sm" weight="semibold">
                Selected ideas
              </Text>
              {scenario.ideas.map((idea, index) => (
                <IdeaRow key={`${idea.title}-${index}`} idea={idea} />
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </ScrollArea>
    </BlockStack>
  );
}

interface MlExperimentPlannerContentProps {
  runId: string;
  selectedScenarioId?: string;
}

export function MlExperimentPlannerContent({
  runId,
  selectedScenarioId,
}: MlExperimentPlannerContentProps) {
  const { scenarios } = useRunScenarios(runId);
  const {
    mutate: runResearch,
    isPending: isResearchPending,
    variables: researchVariables,
  } = useRunAutomatedResearch();
  const [selectedId, setSelectedId] = useState<string | null>(
    selectedScenarioId ?? null,
  );

  if (scenarios.length === 0) {
    return (
      <BlockStack gap="2" fill>
        <Text as="p" size="sm" tone="subdued">
          No experiment scenarios yet.
        </Text>
        <Text as="p" size="xs" tone="subdued">
          Use the &ldquo;Use scenario&rdquo; action in the AI assistant to plan
          one.
        </Text>
      </BlockStack>
    );
  }

  const selectedScenario = scenarios.find(
    (scenario) => scenario.id === selectedId,
  );

  if (selectedScenario) {
    return (
      <BlockStack fill className="p-3">
        <ScenarioDetail
          scenario={selectedScenario}
          onBack={() => setSelectedId(null)}
          onRunResearch={() => runResearch(selectedScenario)}
          isResearchPending={
            isResearchPending && researchVariables?.id === selectedScenario.id
          }
        />
      </BlockStack>
    );
  }

  return (
    <BlockStack fill className="p-3">
      <ScrollArea className="h-full w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Score</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Ideas</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenarios.map((scenario) => (
              <ScenarioRow
                key={scenario.id}
                scenario={scenario}
                onSelect={() => setSelectedId(scenario.id)}
                onRunResearch={() => runResearch(scenario)}
                isResearchPending={
                  isResearchPending && researchVariables?.id === scenario.id
                }
              />
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </BlockStack>
  );
}
