import { ProjectCard } from "@/components/Home/ProjectsSection/ProjectCard";
import { useMyProjects } from "@/components/Home/ProjectsSection/useMyProjects";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";

import { SectionHeader } from "./SectionHeader";

const PREVIEW_MAX = 8;

/**
 * One row, however wide the window is: the cards that do not fit wrap into a
 * second row the fixed height clips, so the section never scrolls sideways and
 * never grows a second line. The height is `ProjectCard`'s own `min-h-56`.
 */
const SINGLE_ROW =
  "grid w-full grid-cols-[repeat(auto-fill,minmax(13rem,15rem))] gap-4 grid-rows-1 h-56 overflow-hidden";

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
        <div className={SINGLE_ROW}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </BlockStack>
  );
}
