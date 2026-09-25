import { ProjectCard } from "@/components/Home/ProjectsSection/ProjectCard";
import { PROJECT_GRID_ONE_ROW } from "@/components/Home/ProjectsSection/projectGrid";
import { useMyProjects } from "@/components/Home/ProjectsSection/useMyProjects";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";

import { SectionHeader } from "./SectionHeader";

const PREVIEW_MAX = 8;

export function ProjectsPreview() {
  const isProjectsEnabled = useFlagValue("projects");
  const tangentEnabled = useFlagValue("tangent-shell");
  const { configured, available } = useBackend();
  const { projects: all, isPending } = useMyProjects();

  // A preview carries no backend warnings of its own — the runs section below
  // it already says when the backend is the problem.
  if (!isProjectsEnabled || !configured || !available) return null;

  const projects = all.slice(0, PREVIEW_MAX);

  return (
    <BlockStack gap="3">
      <SectionHeader
        title="My Projects"
        viewAllTo={APP_ROUTES.PROJECTS}
        viewAllLabel="View all projects"
      />
      {!isPending && projects.length === 0 ? (
        <Text size="sm" tone="subdued">
          {tangentEnabled
            ? "No projects yet — start a session to make one."
            : "No projects yet."}
        </Text>
      ) : (
        <div className={PROJECT_GRID_ONE_ROW}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </BlockStack>
  );
}
