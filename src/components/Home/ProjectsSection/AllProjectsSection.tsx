import { useQuery } from "@tanstack/react-query";

import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import { userQueryOptions } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { useAllProjects } from "@/services/projects/useAllProjects";

import { ProjectCard } from "./ProjectCard";
import { ProjectFiltersBar } from "./ProjectFiltersBar";
import { useProjectFilters } from "./useProjectFilters";

const UNRESOLVED_USER_ID = "Unknown";

export function AllProjectsSection() {
  const { configured, available, ready } = useBackend();
  const { data: user } = useQuery(userQueryOptions);

  if (!ready || !configured || !available) {
    return null;
  }

  return (
    <BlockStack gap="4">
      <Heading level={2}>All Projects</Heading>
      <AllProjectsBody
        currentUserId={user?.id === UNRESOLVED_USER_ID ? undefined : user?.id}
      />
    </BlockStack>
  );
}

function AllProjectsBody({
  currentUserId,
}: {
  currentUserId: string | undefined;
}) {
  const { data, isPending, error } = useAllProjects();
  const { filteredProjects, filterBarProps } = useProjectFilters(
    data?.items ?? [],
    currentUserId,
  );

  if (isPending) {
    return (
      <InlineStack gap="2" blockAlign="center">
        <Spinner /> Loading...
      </InlineStack>
    );
  }

  if (error) {
    return (
      <InfoBox title="Error loading projects" variant="error">
        {error.message}
      </InfoBox>
    );
  }

  if (data.items.length === 0) {
    return (
      <Text size="sm" tone="subdued">
        No projects have been created yet.
      </Text>
    );
  }

  return (
    <BlockStack gap="4">
      <ProjectFiltersBar filters={filterBarProps} />

      {filteredProjects.length === 0 ? (
        <Text size="sm" tone="subdued">
          No projects match these filters.
        </Text>
      ) : (
        <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(13rem,15rem))] gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} showAuthor />
          ))}
        </div>
      )}

      {data.reachedPageLimit && (
        <Text size="sm" tone="subdued">
          {`Searching the ${data.items.length} most recently updated projects of ${data.totalCount}.`}
        </Text>
      )}
    </BlockStack>
  );
}
