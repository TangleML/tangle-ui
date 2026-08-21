import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { TangentProjectSummary } from "@/routes/v2/pages/Tangent/hooks/useTangentProjects";

import { ProjectCard } from "./ProjectCard";

interface ProjectGridProps {
  projects: TangentProjectSummary[];
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <BlockStack
        gap="1"
        align="center"
        className="rounded-xl border border-dashed border-border p-10"
      >
        <Text size="sm" weight="semibold">
          No projects yet
        </Text>
        <Text size="sm" tone="subdued">
          Describe what you want to build above to start your first project.
        </Text>
      </BlockStack>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
