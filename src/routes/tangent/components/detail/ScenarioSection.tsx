import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { IdeaCard } from "@/routes/tangent/components/detail/IdeaCard";
import type { ExperimentIdea } from "@/routes/tangent/types";

interface ScenarioSectionProps {
  ideas: ExperimentIdea[];
}

function builtCount(ideas: ExperimentIdea[]): number {
  return ideas.filter((idea) => idea.buildState === "built").length;
}

function IdeaSubsection({
  title,
  ideas,
  emptyMessage,
}: {
  title: string;
  ideas: ExperimentIdea[];
  emptyMessage: string;
}) {
  return (
    <BlockStack gap="2">
      <Text size="sm" weight="semibold">
        {title} ({builtCount(ideas)}/{ideas.length} built)
      </Text>
      {ideas.length === 0 ? (
        <Paragraph size="sm" tone="subdued">
          {emptyMessage}
        </Paragraph>
      ) : (
        <BlockStack gap="2">
          {ideas
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
        </BlockStack>
      )}
    </BlockStack>
  );
}

export function ScenarioSection({ ideas }: ScenarioSectionProps) {
  const notify = useToastNotification();
  const tangentIdeas = ideas.filter((idea) => idea.source === "tangent");
  const humanIdeas = ideas.filter((idea) => idea.source === "human");

  return (
    <BlockStack gap="4">
      <InlineStack
        align="space-between"
        blockAlign="center"
        wrap="wrap"
        gap="3"
      >
        <Heading level={2}>Scenarios</Heading>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            notify(
              "Creating scenarios is not wired up in the Phase 1 prototype yet.",
              "info",
            )
          }
        >
          + New Scenario
        </Button>
      </InlineStack>
      <Paragraph size="sm" tone="subdued">
        Each scenario starts as an idea. Click ⚡ Auto build on a Tangent idea
        to generate scenario.yaml + MEMORY.md in the background.
      </Paragraph>

      <IdeaSubsection
        title="Tangent recommended"
        ideas={tangentIdeas}
        emptyMessage="No Tangent-generated ideas yet — click Re-analyze in the top nav."
      />
      <IdeaSubsection
        title="Human recommended"
        ideas={humanIdeas}
        emptyMessage="Be the first — click + New Scenario above."
      />
    </BlockStack>
  );
}
