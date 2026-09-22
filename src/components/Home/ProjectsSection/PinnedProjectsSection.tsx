import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

import { PinnedProjectChip } from "./PinnedProjectChip";
import { usePinnedProjects } from "./usePinnedProjects";

export function PinnedProjectsSection() {
  const { projects } = usePinnedProjects();

  // Nothing is said while nothing is pinned: an empty section would only take
  // room from the list it sits above.
  if (projects.length === 0) return null;

  return (
    <BlockStack gap="2">
      <Heading level={2} size="sm">
        Pinned
      </Heading>
      <InlineStack gap="2" className="w-full">
        {projects.map((project) => (
          <PinnedProjectChip key={project.id} project={project} />
        ))}
      </InlineStack>
    </BlockStack>
  );
}
