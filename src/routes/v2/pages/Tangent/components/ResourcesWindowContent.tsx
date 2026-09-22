import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { AddResourceButton } from "@/routes/v2/pages/Tangent/components/AddResourceButton";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  describeResource,
  DOCUMENT,
} from "@/services/projects/resourceDescriptor";
import type { WorkareaTarget } from "@/services/projects/resourceTarget";
import {
  formatWorkareaTarget,
  idIdentity,
} from "@/services/projects/resourceTarget";
import type { ProjectResourceSummary } from "@/services/projects/types";
import {
  useDeleteProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";
import { useProject, useUpdateProject } from "@/services/projects/useProjects";
import { getErrorMessage } from "@/utils/string";

import { EditInstructionsDialog } from "./EditInstructionsDialog";

interface ProjectResourceItem {
  id: string;
  name: string;
  target: WorkareaTarget;
  icon: IconName;
  description: string;
}

interface ResourceTypeMeta {
  icon: IconName;
  description: string;
}

const RESOURCE_TYPE_META: Record<string, ResourceTypeMeta> = {
  local_pipeline: { icon: "Workflow", description: "Pipeline" },
  pipeline_run: { icon: "Play", description: "Pipeline run" },
  [DOCUMENT]: { icon: "FileText", description: "Document" },
};

/**
 * A document carries its own body, so it records no identity — the row is the
 * document, and the row's own id is what addresses it.
 */
function targetOf(
  resource: ProjectResourceSummary,
  type: string,
  recorded: WorkareaTarget | undefined,
): WorkareaTarget | undefined {
  if (type === DOCUMENT) {
    return { type: "document", identity: idIdentity(resource.id) };
  }
  return recorded;
}

export function ResourcesWindowContent() {
  const store = useTangentProject();
  const notify = useToastNotification();
  const { data: resourcesPage } = useProjectResources(store.projectId, {
    entity: ["document"],
  });
  const { mutate: deleteResource, isPending: isDetachingResource } =
    useDeleteProjectResource(store.projectId);

  const resources: ProjectResourceItem[] = (resourcesPage?.items ?? []).flatMap(
    (resource) => {
      const described = describeResource(resource);
      const meta = described && RESOURCE_TYPE_META[described.type];
      const target =
        described && meta
          ? targetOf(resource, described.type, described.target)
          : undefined;
      if (!target || !meta) return [];
      return [
        {
          id: resource.id,
          name: resource.name ?? formatWorkareaTarget(target),
          target,
          icon: meta.icon,
          description: meta.description,
        },
      ];
    },
  );

  async function handleOpenResource(resource: ProjectResourceItem) {
    try {
      await store.openWorkareaTarget(resource.target, resource.name);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  }

  return (
    <BlockStack gap="4" className="p-2">
      <BlockStack className="border rounded-md divide-y overflow-auto hide-scrollbar">
        <InstructionsRow projectId={store.projectId} />
        {resources.map((resource) => (
          <ResourceRow
            key={resource.id}
            icon={resource.icon}
            title={resource.name}
            description={resource.description}
            testId={`open-resource-${resource.id}`}
            onOpen={() => void handleOpenResource(resource)}
            action={
              <Button
                variant="ghost"
                size="min"
                className="mr-1 mt-2 shrink-0"
                aria-label={`Remove ${resource.name}`}
                title="Remove"
                disabled={isDetachingResource}
                onClick={() => deleteResource(resource.id)}
              >
                <Icon name="X" size="xs" />
              </Button>
            }
          />
        ))}
      </BlockStack>

      <AddResourceButton projectId={store.projectId} />
    </BlockStack>
  );
}

interface ResourceRowProps {
  icon: IconName;
  title: string;
  description: string;
  titleSubdued?: boolean;
  disabled?: boolean;
  testId?: string;
  onOpen: () => void;
  action?: ReactNode;
}

function ResourceRow({
  icon,
  title,
  description,
  titleSubdued,
  disabled,
  testId,
  onOpen,
  action,
}: ResourceRowProps) {
  return (
    <InlineStack
      blockAlign="start"
      wrap="nowrap"
      className="w-full hover:bg-accent"
    >
      <Button
        variant="ghost"
        disabled={disabled}
        data-testid={testId}
        title={title}
        onClick={onOpen}
        className="h-auto min-w-0 flex-1 items-start justify-start gap-3 px-2 py-2"
      >
        <InlineStack
          align="center"
          blockAlign="center"
          className="size-9 shrink-0 rounded-md bg-muted text-muted-foreground"
        >
          <Icon name={icon} size="lg" />
        </InlineStack>
        <BlockStack align="start" className="min-w-0 text-left">
          <Text
            size="sm"
            weight="medium"
            tone={titleSubdued ? "subdued" : "inherit"}
            className="max-w-full truncate"
          >
            {title}
          </Text>
          <Text size="xs" tone="subdued" className="max-w-full truncate">
            {description}
          </Text>
        </BlockStack>
      </Button>
      {action}
    </InlineStack>
  );
}

function InstructionsRow({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const { mutate: updateProject, isPending: isSavingInstructions } =
    useUpdateProject();
  const { open } = useDialog();

  const instructions = project?.notes ?? "";

  async function handleEditInstructions() {
    const result = await open<string, { currentInstructions: string }>({
      component: EditInstructionsDialog,
      props: { currentInstructions: instructions },
      routeKey: "edit-instructions",
    }).catch(convertCancelErrorTo(undefined));

    if (result === undefined) return;
    updateProject({ id: projectId, input: { notes: result } });
  }

  return (
    <ResourceRow
      icon="FileText"
      title={instructions ? "Instructions" : "No instructions yet"}
      titleSubdued={!instructions}
      description="Standing context for agents"
      disabled={isSavingInstructions}
      testId="edit-instructions"
      onOpen={() => void handleEditInstructions()}
    />
  );
}
