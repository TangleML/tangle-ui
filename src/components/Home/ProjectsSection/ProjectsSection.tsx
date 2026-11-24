import { WorkspaceNotice } from "@/components/Project/WorkspaceNotice";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { activeWorkspaces } from "@/services/projects/defaultWorkspace";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { AllProjectsTable } from "./AllProjectsTable";
import { CreateProjectDialog } from "./CreateProjectDialog";

export function ProjectsSection() {
  const { configured, available, ready, backendUrl } = useBackend();
  const { data: workspaces, error: workspaceError } = useWorkspaces();

  if (!ready) {
    return (
      <InlineStack gap="2" blockAlign="center">
        <Spinner /> Loading...
      </InlineStack>
    );
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
    <section
      aria-labelledby="all-projects"
      className="min-w-0 w-full space-y-4"
    >
      <InlineStack gap="3" align="space-between" blockAlign="center">
        <Heading level={2} id="all-projects">
          All projects
        </Heading>
        {workspaces &&
          !workspaceError &&
          activeWorkspaces(workspaces).length > 0 && (
            <CreateProjectDialog
              key={backendUrl}
              workspaces={workspaces}
              trigger={
                <Button type="button" size="sm">
                  <Icon name="FolderPlus" size="sm" />
                  New project
                </Button>
              }
            />
          )}
      </InlineStack>
      <WorkspaceNotice />
      <AllProjectsTable key={backendUrl} />
    </section>
  );
}
