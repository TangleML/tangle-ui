import { useNavigate } from "@tanstack/react-router";

import {
  ENTITY_ORDER,
  pluralize,
} from "@/components/Home/ProjectsSection/formatResourceCounts";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { InfoBox } from "@/components/shared/InfoBox";
import { useTangentEnabled } from "@/components/shared/Settings/useFlags";
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
import { APP_ROUTES } from "@/routes/appRoutes";
import {
  newTangentSessionSearch,
  tangentSessionSearch,
} from "@/routes/tangentSearch";
import { useAiGate } from "@/routes/v2/shared/components/AiChat/components/useAiGate";
import {
  AGENT_SESSION,
  describeResource,
  INSTRUCTIONS,
} from "@/services/projects/resourceDescriptor";
import { sessionLabelsById } from "@/services/projects/sessionLabel";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { useLocalPipelineStatus } from "@/services/projects/useLocalPipelineStatus";
import { useProjectResources } from "@/services/projects/useProjectResources";
import { tracking } from "@/utils/tracking";

import { AddResourceMenu } from "./AddResourceMenu";
import { ColumnHeadingRow } from "./ColumnHeadingRow";
import { entityIcon } from "./resourceEntities";
import { ResourceRow } from "./ResourceRow";
import { useConfirmedResourceRemoval } from "./useConfirmedResourceRemoval";

const PAGE_SIZE = 100;

const COLUMN_COUNT = 3;

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

/**
 * Grouped by the API's `entity`, not by what each row is, so these counts agree
 * with the project tile's — which are read off the API and cannot be worked out
 * per-kind without reading every project's resources.
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
  const navigate = useNavigate();
  const tangentEnabled = useTangentEnabled();
  const aiGate = useAiGate();
  const { confirmAndRemove, confirmation: confirmationProps } =
    useConfirmedResourceRemoval({
      projectId,
      trackingEvent: "projects.remove_resource_completed",
      onRemoved: (resource) => {
        if (resource.id === selectedResourceId) {
          onSelect(null);
        }
      },
    });

  // Instructions have their own box in the sidebar, so listing the document
  // they live in would offer a second way to write one thing and a Remove that
  // silently wipes it.
  const allResources = data?.items ?? [];
  const resources = allResources.filter((resource) => {
    if (describeResource(resource)?.type === INSTRUCTIONS) return false;
    return tangentEnabled || resource.entity !== AGENT_SESSION;
  });

  const { currentNames: currentPipelineNames } =
    useLocalPipelineStatus(resources);

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
        {tangentEnabled && (
          <Button
            variant="outline"
            size="sm"
            disabled={aiGate.disabled}
            title={aiGate.title}
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
        )}
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
                // A session is a conversation that lives in Tangent, so its row
                // opens there; a renamed pipeline is still a row on this page.
                const sessionLabel = sessionLabels.get(resource.id);
                return (
                  <ResourceRow
                    key={resource.id}
                    resource={resource}
                    label={
                      sessionLabel ?? currentPipelineNames.get(resource.id)
                    }
                    opensElsewhere={sessionLabel !== undefined}
                    selected={resource.id === selectedResourceId}
                    onSelect={(picked) => {
                      if (sessionLabel) {
                        openSession(picked);
                        return;
                      }
                      onSelect(
                        picked.id === selectedResourceId ? null : picked.id,
                      );
                    }}
                    // Like a run, a session that happened belongs to the
                    // project it happened in.
                    onRemove={
                      sessionLabel
                        ? undefined
                        : (picked) => void confirmAndRemove(picked)
                    }
                  />
                );
              })}
            </TableBody>
          ))}
        </Table>
      )}

      {data?.nextPageToken && (
        <Text size="sm" tone="subdued">
          {/* `totalCount` spans every page; what this page hides says nothing
              about the pages not fetched, so subtracting it here would take a
              page's worth off a total counted elsewhere. */}
          {`Showing the first ${resources.length} of ${data.totalCount} items.`}
        </Text>
      )}

      <ConfirmationDialog {...confirmationProps} />
    </BlockStack>
  );
}
