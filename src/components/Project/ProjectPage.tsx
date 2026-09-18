import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { ProjectsApiError } from "@/services/projects/errors";
import { useProject } from "@/services/projects/useProjects";

import { ProjectHeader } from "./ProjectHeader";
import { ProjectResourcePreview } from "./ProjectResourcePreview";
import { ProjectResources } from "./ProjectResources";
import { ProjectRuns } from "./ProjectRuns";
import { ProjectSidebar } from "./ProjectSidebar";

export function ProjectPage() {
  const { projectId } = useParams({ strict: false });
  const { configured, available, ready } = useBackend();

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

  return <ProjectDetail projectId={projectId} />;
}

const LoadingProject = () => (
  <InlineStack gap="2" blockAlign="center">
    <Spinner /> Loading...
  </InlineStack>
);

const BackToProjects = () => (
  <Link to={APP_ROUTES.PROJECTS} className="w-fit underline">
    <Text size="sm">Back to projects</Text>
  </Link>
);

function ProjectDetail({ projectId }: { projectId: string | undefined }) {
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    null,
  );
  const { data: project, isPending, error } = useProject(projectId);

  if (isPending) {
    return <LoadingProject />;
  }

  if (error) {
    const isMissing = error instanceof ProjectsApiError && error.status === 404;

    return (
      <BlockStack gap="3" inlineAlign="start">
        <InfoBox
          title={isMissing ? "Project not found" : "Error loading project"}
          variant={isMissing ? "warning" : "error"}
        >
          {isMissing
            ? "This project does not exist, or it has been deleted."
            : error.message}
        </InfoBox>
        <BackToProjects />
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="6">
      <ProjectHeader project={project} />

      <div className="flex w-full flex-col items-start gap-6 xl:flex-row xl:gap-8">
        <BlockStack gap="6" className="w-full shrink-0 xl:w-104">
          <ProjectResources
            projectId={project.id}
            selectedResourceId={selectedResourceId}
            onSelect={setSelectedResourceId}
          />
          <Separator />
          <ProjectRuns projectId={project.id} />
        </BlockStack>

        <div className="min-w-0 w-full flex-1">
          <ProjectResourcePreview
            projectId={project.id}
            resourceId={selectedResourceId}
          />
        </div>

        <ProjectSidebar project={project} />
      </div>
    </BlockStack>
  );
}
