import { InfoBox } from "@/components/shared/InfoBox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { CreateProjectDialog } from "./CreateProjectDialog";
import { NewProjectCard } from "./NewProjectCard";
import { ProjectCard } from "./ProjectCard";
import { useMyProjects } from "./useMyProjects";
import { usePinnedProjects } from "./usePinnedProjects";

const LoadingProjects = () => (
  <InlineStack gap="2" blockAlign="center">
    <Spinner /> Loading...
  </InlineStack>
);

export function ProjectsSection() {
  const { configured, available, ready } = useBackend();

  if (!ready) {
    return <LoadingProjects />;
  }

  if (!configured) {
    return (
      <InfoBox title="Backend not configured" variant="warning">
        Configure a backend to create and view projects.
      </InfoBox>
    );
  }

  if (!available) {
    return (
      <InfoBox title="Backend not available" variant="warning">
        The configured backend is currently unavailable.
      </InfoBox>
    );
  }

  return <ProjectsGrid />;
}

function ProjectsGrid() {
  const {
    projects: allProjects,
    createdBy,
    totalCount,
    isPending,
    error,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useMyProjects();
  const { data: workspaces } = useWorkspaces();
  const { projects: pinned } = usePinnedProjects();

  // Pinned projects lead the grid, and are dropped from the tail so a pinned
  // project of the caller's own moves rather than appearing twice. A pinned
  // project someone else made was never in this list to be dropped from.
  const pinnedIds = new Set(pinned.map((project) => project.id));
  const rest = allProjects.filter((project) => !pinnedIds.has(project.id));
  const shown = pinned.length + rest.length;

  // Counted by authorship rather than by what has been paged in: a pinned
  // project of the caller's own is inside `totalCount` whether or not its page
  // has been fetched yet. Without a resolved user the list is everyone's, so
  // every pinned project is already in there.
  const sharedPins = createdBy
    ? pinned.filter((project) => project.createdBy !== createdBy).length
    : 0;
  const available = totalCount + sharedPins;

  if (isPending) {
    return <LoadingProjects />;
  }

  if (error) {
    return (
      <InfoBox title="Error loading projects" variant="error">
        {error.message}
      </InfoBox>
    );
  }

  // Nothing in the UI names a workspace: a project goes into the first one the
  // backend offers, and creation is withdrawn when it offers none.
  const targetWorkspaceId = workspaces?.[0]?.id;

  return (
    <BlockStack gap="4">
      {!targetWorkspaceId && (
        <Alert className="w-fit">
          <Icon name="CircleAlert" />
          <AlertDescription>
            Projects cannot be created yet. Contact your Tangle Admin for help.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(13rem,15rem))] gap-4">
        {targetWorkspaceId && (
          <CreateProjectDialog
            workspaceId={targetWorkspaceId}
            trigger={<NewProjectCard />}
          />
        )}
        {pinned.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        {rest.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      {hasMore && (
        <InlineStack gap="3" blockAlign="center">
          <Button variant="outline" disabled={isLoadingMore} onClick={loadMore}>
            {isLoadingMore ? "Loading..." : "Load more projects"}
          </Button>
          <Text size="sm" tone="subdued">
            {`Showing ${shown} of ${available}.`}
          </Text>
        </InlineStack>
      )}
    </BlockStack>
  );
}
