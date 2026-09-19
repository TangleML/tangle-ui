import { useNavigate } from "@tanstack/react-router";

import {
  ENTITY_ORDER,
  pluralize,
} from "@/components/Home/ProjectsSection/formatResourceCounts";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { IconName } from "@/components/ui/icon";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Heading, Text } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import {
  newTangentSessionSearch,
  tangentSessionSearch,
} from "@/routes/tangentSearch";
import { sessionLabelsById } from "@/services/projects/sessionLabel";
import type { ProjectResourceSummary } from "@/services/projects/types";
import {
  useDeleteProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";
import { tracking } from "@/utils/tracking";

import { AddResourceMenu } from "./AddResourceMenu";
import { ColumnHeadingRow } from "./ColumnHeadingRow";
import { claimsLocalPipeline } from "./localPipelinePointer";
import { entityIcon, removingDestroys } from "./resourceEntities";
import { ResourceRow, UNTITLED } from "./ResourceRow";

const PAGE_SIZE = 100;

const COLUMN_COUNT = 3;

const AGENT_SESSION = "agent_session";

// A group names the kind of thing it holds, so it stays plural whatever the count.
const PLURAL = 2;

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const groupHeading = (entity: string, count: number) =>
  `${capitalize(pluralize(entity, PLURAL))} (${count})`;

interface GroupHeadingProps {
  icon: IconName;
  label: string;
}

function GroupHeading({ icon, label }: GroupHeadingProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableHead colSpan={COLUMN_COUNT} scope="rowgroup" className="px-2 pt-4">
        <InlineStack gap="1" blockAlign="center" wrap="nowrap">
          <Icon
            name={icon}
            size="xs"
            className="shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <Text size="xs" tone="subdued">
            {label}
          </Text>
        </InlineStack>
      </TableHead>
    </TableRow>
  );
}

function removalConsequence(resource: ProjectResourceSummary) {
  if (claimsLocalPipeline(resource)) {
    return "This only takes it out of this project. The pipeline itself is not deleted and stays in the browser that holds it.";
  }
  if (removingDestroys(resource)) {
    return "This is the only copy, so deleting it here deletes it for good.";
  }
  return "This only takes it out of this project. The item itself is not deleted and stays wherever it lives.";
}

/**
 * Grouped by what the API calls each thing, not by what it is, so the counts
 * here agree with the counts on the project's tile — which are read straight
 * off the API and cannot be worked out per-kind without reading every
 * project's resources. A browser-held pipeline is therefore filed with the
 * documents, and says what it is for itself on its own row.
 */
function groupByEntity(resources: ProjectResourceSummary[]) {
  const grouped = new Map<string, ProjectResourceSummary[]>();
  for (const resource of resources) {
    const existing = grouped.get(resource.entity);
    if (existing) {
      existing.push(resource);
    } else {
      grouped.set(resource.entity, [resource]);
    }
  }

  const known = ENTITY_ORDER.filter((entity) => grouped.has(entity));
  const unknown = [...grouped.keys()]
    .filter((entity) => !ENTITY_ORDER.includes(entity))
    .sort();

  return [...known, ...unknown].map((entity) => ({
    entity,
    items: grouped.get(entity) ?? [],
  }));
}

interface ProjectResourcesProps {
  projectId: string;
  selectedResourceId: string | null;
  onSelect: (resourceId: string | null) => void;
}

export function ProjectResources({
  projectId,
  selectedResourceId,
  onSelect,
}: ProjectResourcesProps) {
  const { data, isPending, error } = useProjectResources(projectId, {
    pageSize: PAGE_SIZE,
  });
  const removeResource = useDeleteProjectResource(projectId);
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const navigate = useNavigate();
  const {
    handlers: confirmationHandlers,
    triggerDialog: triggerConfirmation,
    ...confirmationProps
  } = useConfirmationDialog();

  const handleRemove = async (resource: ProjectResourceSummary) => {
    const destroys = removingDestroys(resource);
    const name = resource.name ?? UNTITLED;

    const confirmed = await triggerConfirmation({
      title: destroys
        ? `Delete "${name}"?`
        : `Remove "${name}" from this project?`,
      description: removalConsequence(resource),
    });

    if (!confirmed) return;

    removeResource.mutate(resource.id, {
      onSuccess: () => {
        if (resource.id === selectedResourceId) {
          onSelect(null);
        }
        track("projects.remove_resource_completed", {
          entity: resource.entity,
          destroyed: destroys,
        });
        notify(destroys ? "Deleted" : "Removed from project", "success");
      },
    });
  };

  const resources = data?.items ?? [];

  // A session is the one resource that is not a thing to look at here: it is a
  // conversation that lives in Tangent, so its row goes there. It is also not a
  // thing to take back out — like a run, a session that happened belongs to the
  // project it happened in — so its row is not offered a way to.
  const sessionLabels = sessionLabelsById(
    resources
      .filter(
        (resource) => resource.entity === AGENT_SESSION && resource.entityId,
      )
      .map((resource) => [resource.id, resource]),
  );

  const openSession = (resource: ProjectResourceSummary) => {
    if (!resource.entityId) return;
    void navigate({
      to: APP_ROUTES.TANGENT_PROJECT,
      params: { projectId },
      search: tangentSessionSearch(resource.entityId),
    });
  };

  return (
    <BlockStack gap="4">
      <ColumnHeadingRow>
        <Heading level={2}>Resources</Heading>
        <AddResourceMenu projectId={projectId} resources={resources} />
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void navigate({
              to: APP_ROUTES.TANGENT_PROJECT,
              params: { projectId },
              search: newTangentSessionSearch,
            })
          }
          {...tracking("projects.start_session")}
        >
          <Icon name="MessagesSquare" size="sm" />
          New session
        </Button>
      </ColumnHeadingRow>

      {isPending && (
        <InlineStack gap="2" blockAlign="center">
          <Spinner /> Loading...
        </InlineStack>
      )}

      {error && (
        <InfoBox title="Error loading resources" variant="error">
          {error.message}
        </InfoBox>
      )}

      {data && resources.length === 0 && (
        <EmptyState
          icon="Box"
          placement="start"
          title="Nothing in this project yet"
          description="Add pipelines, documents and other context for this project."
          className="max-w-lg"
        />
      )}

      {data && resources.length > 0 && (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-2">
                <Text size="xs" tone="subdued">
                  Name
                </Text>
              </TableHead>
              <TableHead className="w-28 px-2 text-right">
                <Text size="xs" tone="subdued">
                  Added
                </Text>
              </TableHead>
              <TableHead className="w-12 px-2">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          {groupByEntity(resources).map(({ entity, items }) => (
            <TableBody key={entity}>
              <GroupHeading
                icon={entityIcon(entity)}
                label={groupHeading(entity, items.length)}
              />

              {items.map((resource) => {
                const label = sessionLabels.get(resource.id);
                return (
                  <ResourceRow
                    key={resource.id}
                    resource={resource}
                    label={label}
                    opensElsewhere={label !== undefined}
                    selected={resource.id === selectedResourceId}
                    onSelect={(picked) => {
                      if (label) {
                        openSession(picked);
                        return;
                      }
                      onSelect(
                        picked.id === selectedResourceId ? null : picked.id,
                      );
                    }}
                    onRemove={label ? undefined : handleRemove}
                  />
                );
              })}
            </TableBody>
          ))}
        </Table>
      )}

      {data?.nextPageToken && (
        <Text size="sm" tone="subdued">
          {`Showing the first ${resources.length} of ${data.totalCount} items.`}
        </Text>
      )}

      <ConfirmationDialog
        {...confirmationProps}
        onConfirm={() => confirmationHandlers?.onConfirm()}
        onCancel={() => confirmationHandlers?.onCancel()}
      />
    </BlockStack>
  );
}
