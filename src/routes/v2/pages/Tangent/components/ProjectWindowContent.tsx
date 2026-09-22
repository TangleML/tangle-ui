import { ProjectAbout } from "@/components/Project/ProjectAbout";
import { useDeleteProjectAction } from "@/components/Project/useDeleteProjectAction";
import { useShareProjectAction } from "@/components/Project/useShareProjectAction";
import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import type { Project } from "@/services/projects/types";
import { useProject } from "@/services/projects/useProjects";
import { formatDate, formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

export function ProjectWindowContent() {
  const store = useTangentProject();
  const { data: project, isPending } = useProject(store.projectId);

  if (isPending) {
    return (
      <InlineStack gap="2" blockAlign="center" className="p-2">
        <Spinner />
        <Text size="xs" tone="subdued">
          Loading…
        </Text>
      </InlineStack>
    );
  }

  if (!project) {
    return (
      <Text size="xs" tone="subdued" className="block p-2">
        This project could not be loaded.
      </Text>
    );
  }

  return (
    <BlockStack gap="4" align="stretch" className="p-2">
      {/* Instructions are edited from the Resources window here, where they sit
          with the other things the agents are given. */}
      <ProjectAbout project={project} showInstructions={false} />

      <Separator />

      <BlockStack gap="1" align="stretch">
        <Detail label="Created by" value={project.createdBy ?? "Unknown"} />
        <Detail label="Created" value={formatDate(project.createdAt)} />
        <Detail
          label="Updated"
          value={formatRelativeTime(project.updatedAt) ?? "Unknown"}
        />
      </BlockStack>

      <Separator />

      <BlockStack gap="1" align="stretch">
        <ShareProject projectId={project.id} />
        <DeleteProject project={project} />
      </BlockStack>
    </BlockStack>
  );
}

function ShareProject({ projectId }: { projectId: string }) {
  const share = useShareProjectAction(projectId);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      onClick={share}
      {...tracking("projects.share_project")}
    >
      <Icon name="Share2" size="sm" />
      Share project
    </Button>
  );
}

function DeleteProject({ project }: { project: Project }) {
  const { confirmAndDelete, isDeleting, confirmation } =
    useDeleteProjectAction(project);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-destructive hover:text-destructive"
        disabled={isDeleting}
        onClick={() => void confirmAndDelete()}
        {...tracking("projects.delete_project_open")}
      >
        <Icon name="Trash2" size="sm" />
        Delete project
      </Button>

      <ConfirmationDialog {...confirmation} />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <InlineStack
      gap="2"
      align="space-between"
      blockAlign="start"
      wrap="nowrap"
      className="w-full"
    >
      <Text size="xs" tone="subdued">
        {label}
      </Text>
      <Text size="xs" className="min-w-0 truncate text-right">
        {value}
      </Text>
    </InlineStack>
  );
}
