import { BlockStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";

import { ProjectCard } from "./ProjectCard";
import { useSharedProjects } from "./useSharedProjects";

export function SharedProjectsSection() {
  const { projects } = useSharedProjects();

  // Nothing is said while the list is empty: someone who has never followed a
  // shared link would otherwise be told about a feature they have not met.
  if (projects.length === 0) return null;

  return (
    <BlockStack gap="4">
      <BlockStack gap="1">
        <Heading level={2}>Shared with me</Heading>
        <Text size="sm" tone="subdued">
          Projects you have opened that someone else created. Star one to keep
          it here.
        </Text>
      </BlockStack>
      <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(13rem,15rem))] gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </BlockStack>
  );
}
