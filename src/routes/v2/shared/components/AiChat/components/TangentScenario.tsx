import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import {
  saveScenario,
  type ScenarioEntry,
  type ScenarioIdea,
} from "@/routes/tangent/idb/tangentDb";
import { useMlExperimentPlannerWindow } from "@/routes/v2/shared/components/MlExperimentPlanner/useMlExperimentPlannerWindow";

type Impact = "high" | "medium" | "low";

type IdeaType =
  | "feature_engineering"
  | "hyperparameter_optimization"
  | "input_data"
  | "model_architecture";

interface ScenarioIdeaData {
  title: string;
  ideaType: IdeaType;
  impact: Impact;
  evidence: string;
}

interface Scenario {
  score: number;
  rationale: string;
  summary: string;
  ideas: ScenarioIdeaData[];
}

const IDEA_TYPE_LABEL: Record<IdeaType, string> = {
  feature_engineering: "Feature engineering",
  hyperparameter_optimization: "Hyperparameter optimization",
  input_data: "Input data",
  model_architecture: "Model architecture",
};

type BadgeVariant = "default" | "secondary" | "outline";

const IMPACT_VARIANT: Record<Impact, BadgeVariant> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseIdea(value: unknown): ScenarioIdeaData | null {
  if (!isRecord(value)) return null;
  const { title, ideaType, impact, evidence } = value;
  if (typeof title !== "string") return null;
  if (
    ideaType !== "feature_engineering" &&
    ideaType !== "hyperparameter_optimization" &&
    ideaType !== "input_data" &&
    ideaType !== "model_architecture"
  ) {
    return null;
  }
  if (impact !== "high" && impact !== "medium" && impact !== "low") return null;
  if (typeof evidence !== "string") return null;
  return { title, ideaType, impact, evidence };
}

function parseScenario(raw: string): Scenario | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { score, rationale, summary, ideas } = value;
  if (typeof score !== "number") return null;
  if (typeof rationale !== "string") return null;
  if (typeof summary !== "string") return null;
  if (!Array.isArray(ideas)) return null;

  const parsedIdeas: ScenarioIdeaData[] = [];
  for (const idea of ideas) {
    const parsed = parseIdea(idea);
    if (parsed) parsedIdeas.push(parsed);
  }

  return { score, rationale, summary, ideas: parsedIdeas };
}

function scoreVariant(score: number): BadgeVariant {
  if (score >= 70) return "default";
  if (score >= 40) return "secondary";
  return "outline";
}

interface IdeaCardProps {
  idea: ScenarioIdeaData;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function IdeaCard({ idea, checked, onCheckedChange }: IdeaCardProps) {
  return (
    <Card className="gap-3 py-3">
      <CardHeader className="px-4">
        <InlineStack gap="2" blockAlign="start" wrap="nowrap">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => onCheckedChange(value === true)}
            aria-label={`Include idea ${idea.title}`}
            className="mt-0.5"
          />
          <BlockStack gap="1">
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
          </BlockStack>
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

export function TangentScenario({ raw }: { raw: string }) {
  const scenario = parseScenario(raw);
  const ideaCount = scenario?.ideas.length ?? 0;
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(Array.from({ length: ideaCount }, (_, index) => index)),
  );

  const executionData = useExecutionDataOptional();
  const runId = executionData?.runId ?? undefined;
  const openPlanner = useMlExperimentPlannerWindow();

  if (!scenario) {
    return (
      <Paragraph size="sm" className="my-1">
        {raw}
      </Paragraph>
    );
  }

  const toggleIdea = (index: number, isChecked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isChecked) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  };

  const handleUseScenario = async () => {
    if (!runId) return;

    const selectedIdeas: ScenarioIdea[] = scenario.ideas.filter((_, index) =>
      selected.has(index),
    );
    const now = Date.now();
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `scenario-${now}`;
    const name = selectedIdeas[0]?.title ?? "Experiment plan";

    const entry: ScenarioEntry = {
      id,
      run: { runId, url: window.location.href },
      score: scenario.score,
      rationale: scenario.rationale,
      summary: scenario.summary,
      ideas: selectedIdeas,
      plan: { name, description: scenario.summary },
      createdAt: now,
      updatedAt: now,
    };

    await saveScenario(entry);
    openPlanner(runId, id);
  };

  const canUseScenario = Boolean(runId) && selected.size > 0;

  return (
    <BlockStack gap="3">
      <InlineStack gap="2" blockAlign="center">
        <Badge variant={scoreVariant(scenario.score)} shape="rounded">
          {scenario.score}/100
        </Badge>
        <Text as="span" size="sm" weight="semibold">
          Optimization potential
        </Text>
      </InlineStack>

      <Text as="p" size="sm" tone="subdued">
        {scenario.rationale}
      </Text>

      <Paragraph size="sm" className="whitespace-pre-line leading-relaxed">
        {scenario.summary}
      </Paragraph>

      {scenario.ideas.length > 0 && (
        <BlockStack gap="2">
          <Text as="span" size="sm" weight="semibold">
            Ideas
          </Text>
          {scenario.ideas.map((idea, index) => (
            <IdeaCard
              key={`${idea.title}-${index}`}
              idea={idea}
              checked={selected.has(index)}
              onCheckedChange={(isChecked) => toggleIdea(index, isChecked)}
            />
          ))}
        </BlockStack>
      )}

      <Button
        size="sm"
        onClick={handleUseScenario}
        disabled={!canUseScenario}
        title={runId ? undefined : "Open a run to plan an experiment scenario"}
      >
        Use scenario
      </Button>
    </BlockStack>
  );
}
