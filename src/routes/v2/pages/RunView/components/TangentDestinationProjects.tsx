import { PickerOption } from "@/components/Project/PickerOption";
import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import type { TangentDestinationChoice } from "@/routes/v2/pages/RunView/hooks/useTangentDestinationChoice";
import type { ProjectSummary } from "@/services/projects/types";

interface TangentDestinationProjectsProps {
  choice: TangentDestinationChoice;
}

export function TangentDestinationProjects({
  choice,
}: TangentDestinationProjectsProps) {
  return (
    <BlockStack gap="4" className="min-h-0 flex-1 overflow-y-auto">
      {choice.attributedMatches.length > 0 && (
        <ProjectOptions
          heading="This run's projects"
          projects={choice.attributedMatches}
          choice={choice}
        />
      )}

      {choice.otherMatches.length > 0 && (
        <ProjectOptions
          heading="Your projects"
          projects={choice.otherMatches}
          choice={choice}
        />
      )}

      {choice.isLoading && (
        <InlineStack gap="2" blockAlign="center">
          <Spinner /> Loading...
        </InlineStack>
      )}

      {choice.loadError && (
        <InfoBox title="Error loading projects" variant="error">
          {choice.loadError.message}
        </InfoBox>
      )}

      {choice.hasNoMatches && (
        <Text size="sm" tone="subdued">
          No projects match that.
        </Text>
      )}
    </BlockStack>
  );
}

interface ProjectOptionsProps {
  heading: string;
  projects: readonly ProjectSummary[];
  choice: TangentDestinationChoice;
}

function ProjectOptions({ heading, projects, choice }: ProjectOptionsProps) {
  return (
    <BlockStack gap="1">
      <Heading level={3}>{heading}</Heading>
      {projects.map((project) => (
        <PickerOption
          key={project.id}
          icon="Folder"
          label={project.name}
          detail={choice.workspaceNames?.get(project.workspaceId)}
          isSelected={choice.picked === project.id}
          onClick={() => choice.toggle(project.id)}
          trackingId="v2.run_view.tangent_destination.select_project"
        />
      ))}
    </BlockStack>
  );
}
