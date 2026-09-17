import { useQuery } from "@tanstack/react-query";

import { InfoBox } from "@/components/shared/InfoBox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import { userQueryOptions } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { useProjects } from "@/services/projects/useProjects";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { CreateProjectDialog } from "./CreateProjectDialog";
import { NewProjectCard } from "./NewProjectCard";
import { ProjectCard } from "./ProjectCard";

const UNRESOLVED_USER_ID = "Unknown";

const PAGE_SIZE = 100;

const LoadingProjects = () => (
  <InlineStack gap="2" blockAlign="center">
    <Spinner /> Loading...
  </InlineStack>
);

export function ProjectsSection() {
  return (
    <BlockStack gap="4">
      <Heading level={2}>My Projects</Heading>
      <MyProjects />
    </BlockStack>
  );
}

function MyProjects() {
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
        {data.items.map((project) => (
          <ProjectCard key={project.id} project={project} />
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
