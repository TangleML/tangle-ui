import { Link } from "@tanstack/react-router";

import {
  formatResourceCounts,
  visibleResourceCounts,
} from "@/components/Home/ProjectsSection/formatResourceCounts";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { getProjectHomePath } from "@/routes/projectRoutes";
import { PipelineDetailsCollapsibleSection } from "@/routes/v2/shared/components/PipelineDetailsCollapsibleSection";
import type { Project } from "@/services/projects/types";
import { useProjectsById } from "@/services/projects/useProjects";
import { tracking } from "@/utils/tracking";

function ProjectEntry({ project }: { project: Project }) {
  const tangentEnabled = useFlagValue("tangent-shell");

  const counts = formatResourceCounts(
    visibleResourceCounts(project.resourceCounts, tangentEnabled),
  );

  return (
    <BlockStack gap="2">
      <InlineStack gap="2" blockAlign="center" wrap="nowrap">
        <Icon name="Folder" size="xs" className="shrink-0" />
        <Heading level={3} className="truncate">
          {project.name}
        </Heading>
      </InlineStack>

      {project.description && (
        <Paragraph tone="subdued" size="xs">
          {project.description}
        </Paragraph>
      )}

      <Text size="xs" tone="subdued">
        {counts}
      </Text>

      <Button variant="outline" size="sm" className="w-full" asChild>
        <Link
          to={getProjectHomePath(project.id)}
          {...tracking("projects.open_from_details_panel")}
        >
          <Icon name="ArrowUpRight" size="sm" />
          Open project
        </Link>
      </Button>
    </BlockStack>
  );
}

/**
 * A project deleted since takes the heading with it: attribution is permanent
 * and the reader cannot act on a project that is not there, so naming one would
 * only be something else to read past.
 */
export function ProjectDetailsSection({
  projectIds,
}: {
  projectIds: readonly string[];
}) {
  const projects = useProjectsById(projectIds);

  if (projects.length === 0) {
    return null;
  }

  return (
    <PipelineDetailsCollapsibleSection
      title={projects.length > 1 ? "Projects" : "Project"}
      icon="Folder"
      openDefault
    >
      <BlockStack gap="4">
        {projects.map((project, index) => (
          <BlockStack key={project.id} gap="4">
            {index > 0 && <Separator />}
            <ProjectEntry project={project} />
          </BlockStack>
        ))}
      </BlockStack>
    </PipelineDetailsCollapsibleSection>
  );
}
