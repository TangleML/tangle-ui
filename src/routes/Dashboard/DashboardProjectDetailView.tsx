import { Link, useParams } from "@tanstack/react-router";

import { formatResourceCounts } from "@/components/Home/ProjectsSection/formatResourceCounts";
import { InfoBox } from "@/components/shared/InfoBox";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { useProject } from "@/services/projects/useProjects";
import { useWorkspace } from "@/services/projects/useWorkspaces";
import { formatDate, formatRelativeTime } from "@/utils/date";

const LoadingProject = () => (
  <InlineStack gap="2" blockAlign="center">
    <Spinner /> Loading...
  </InlineStack>
);

export function DashboardProjectDetailView() {
  const { projectId } = useParams({ strict: false });

  return (
    <BlockStack gap="4">
      <Link to={APP_ROUTES.PROJECTS} className="w-fit">
        <InlineStack gap="1" blockAlign="center">
          <Icon name="ArrowLeft" size="sm" />
          <Text size="sm">Back to projects</Text>
        </InlineStack>
      </Link>
      <ProjectDetail projectId={projectId} />
    </BlockStack>
  );
}

function ProjectDetail({ projectId }: { projectId: string | undefined }) {
  const { configured, available, ready } = useBackend();
  const { data: project, isPending, error } = useProject(projectId);
  const { data: workspace, isPending: isWorkspacePending } = useWorkspace(
    project?.workspaceId,
  );

  if (!ready) {
    return <LoadingProject />;
  }

  if (!configured) {
    return (
      <InfoBox title="Backend not configured" variant="warning">
        Configure a backend to view this project.
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

  if (isPending) {
    return <LoadingProject />;
  }

  if (error || !project) {
    return (
      <InfoBox title="Error loading project" variant="error">
        {error?.message ?? "No project was returned from the backend."}
      </InfoBox>
    );
  }

  return (
    <BlockStack gap="3">
      <Heading level={2}>{project.name}</Heading>
      {project.description && (
        <Paragraph tone="subdued">{project.description}</Paragraph>
      )}
      <BlockStack gap="1">
        {!isWorkspacePending && (
          <Text size="sm" tone="subdued">
            {workspace?.name ?? "Unknown workspace"}
          </Text>
        )}
        <Text size="sm" tone="subdued">
          {formatResourceCounts(project.resourceCounts)}
        </Text>
        <Text size="sm" tone="subdued">
          {`Created ${formatDate(project.createdAt)} · Updated ${formatRelativeTime(project.updatedAt)}`}
        </Text>
      </BlockStack>
    </BlockStack>
  );
}
