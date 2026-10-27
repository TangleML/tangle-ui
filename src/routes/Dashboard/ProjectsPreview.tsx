import { ProjectRow } from "@/components/Home/ProjectsSection/ProjectRow";
import { useMyProjects } from "@/components/Home/ProjectsSection/useMyProjects";
import { useProjectsEnabled } from "@/components/shared/Settings/useFlags";
import { useBackend } from "@/providers/BackendProvider";

import {
  DashboardSectionFrame,
  type DashboardWidgetProps,
} from "./DashboardSectionFrame";

export function ProjectsPreview(props: DashboardWidgetProps) {
  const projectsEnabled = useProjectsEnabled();
  const { configured, available } = useBackend();
  const { projects, isPending, error } = useMyProjects();
  const unavailable = !projectsEnabled
    ? "Enable Projects in settings to use this section."
    : !configured || !available
      ? "Connect a backend to see your projects."
      : undefined;
  return (
    <DashboardSectionFrame
      {...props}
      unavailable={unavailable}
      empty={projects.length === 0}
      loading={!unavailable && isPending}
      error={error?.message}
    >
      <div className="overflow-hidden rounded-lg border border-border">
        {projects.slice(0, 5).map((project) => (
          <ProjectRow key={project.id} project={project} compact />
        ))}
      </div>
    </DashboardSectionFrame>
  );
}
