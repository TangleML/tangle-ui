import { WorkspaceNotice } from "@/components/Project/WorkspaceNotice";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { activeWorkspaces } from "@/services/projects/defaultWorkspace";
import { usePinnedProjects } from "@/services/projects/usePinnedProjects";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { CreateProjectDialog } from "./CreateProjectDialog";
import { ProjectRow } from "./ProjectRow";
import { useMyProjects } from "./useMyProjects";

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

  return <ProjectsList />;
}

function ProjectsList() {
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

  // Pinned projects lead the list, so a pinned project of the caller's own is
  // dropped from the tail to move rather than appear twice.
  const pinnedIds = new Set(pinned.map((project) => project.id));
  const rest = allProjects.filter((project) => !pinnedIds.has(project.id));
  const shown = pinned.length + rest.length;

  // By authorship rather than by what has been paged in: the caller's own
  // pinned project is inside `totalCount` whether or not its page is fetched.
  // Without a resolved user the list is everyone's, pins included.
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

  return (
    <BlockStack gap="4" align="stretch">
      <WorkspaceNotice />
      {workspaces && activeWorkspaces(workspaces).length > 0 && (
        <CreateProjectDialog
          workspaces={workspaces}
          trigger={
            <Button type="button" variant="outline" className="self-start">
              <Icon name="Plus" size="sm" />
              New project
            </Button>
          }
        />
      )}
      <div className="overflow-hidden rounded-lg border border-border empty:hidden">
        {pinned.map((project) => (
          <ProjectRow key={project.id} project={project} />
        ))}
        {rest.map((project) => (
          <ProjectRow key={project.id} project={project} />
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
