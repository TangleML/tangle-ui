import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

import { ProjectCard } from "./ProjectCard";
import { usePinnedProjects } from "./usePinnedProjects";

export function PinnedProjectsSection() {
  const { projects } = usePinnedProjects();

  // Nothing is said while nothing is pinned: an empty section would only take
  // room from the list it sits above.
  if (projects.length === 0) return null;

  return (
    <BlockStack gap="4">
      <Heading level={2}>Pinned</Heading>
      <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(13rem,15rem))] gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </BlockStack>
  );
}
