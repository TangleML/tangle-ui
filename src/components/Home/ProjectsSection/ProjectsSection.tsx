import { useQuery } from "@tanstack/react-query";

import { InfoBox } from "@/components/shared/InfoBox";
import { EmptyState } from "@/components/ui/empty-state";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { userQueryOptions } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { useProjects } from "@/services/projects/useProjects";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { ProjectCard } from "./ProjectCard";

const UNRESOLVED_USER_ID = "Unknown";

const PAGE_SIZE = 100;

const LoadingProjects = () => (
  <InlineStack gap="2" blockAlign="center">
    <Spinner /> Loading...
  </InlineStack>
);

export function ProjectsSection() {
  const { configured, available, ready } = useBackend();
  const { data: user, isPending: isUserPending } = useQuery(userQueryOptions);

  if (!ready || isUserPending) {
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

  return (
    <ProjectsGrid
      createdBy={user?.id === UNRESOLVED_USER_ID ? undefined : user?.id}
    />
  );
}

function ProjectsGrid({ createdBy }: { createdBy: string | undefined }) {
  const { data, isPending, error } = useProjects({
    createdBy,
    pageSize: PAGE_SIZE,
  });
  const { data: workspaces } = useWorkspaces();

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

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon="FolderKanban"
        spotlight
        placement="start"
        title="No projects yet"
        description="Create a project to group pipelines, agent sessions, and documents."
      />
    );
  }

  const workspaceNames = new Map(
    (workspaces ?? []).map((workspace) => [workspace.id, workspace.name]),
  );

  return (
    <BlockStack gap="4">
      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            workspaceName={workspaceNames.get(project.workspaceId)}
          />
        ))}
      </div>
      {data.nextPageToken && (
        <Text size="sm" tone="subdued">
          {`Showing the first ${data.items.length} of ${data.totalCount} projects.`}
        </Text>
      )}
    </BlockStack>
  );
}
