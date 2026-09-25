import {
  ENTITY_ORDER,
  pluralize,
} from "@/components/Home/ProjectsSection/formatResourceCounts";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { InfoBox } from "@/components/shared/InfoBox";
import { EmptyState } from "@/components/ui/empty-state";
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
import type { ProjectResourceSummary } from "@/services/projects/types";
import {
  useDeleteProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";

import { AddResourceMenu } from "./AddResourceMenu";
import { ColumnHeadingRow } from "./ColumnHeadingRow";
import { entityIcon, removingDestroys } from "./resourceEntities";
import { ResourceRow, UNTITLED } from "./ResourceRow";

const PAGE_SIZE = 100;

const COLUMN_COUNT = 3;

// A group names the kind of thing it holds, so it stays plural whatever the count.
const PLURAL = 2;

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const groupHeading = (entity: string, count: number) =>
  `${capitalize(pluralize(entity, PLURAL))} (${count})`;

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
  const {
    handlers: confirmationHandlers,
    triggerDialog: triggerConfirmation,
    ...confirmationProps
  } = useConfirmationDialog();

  const handleRemove = async (resource: ProjectResourceSummary) => {
    const destroys = removingDestroys(resource);
    const name = resource.name ?? UNTITLED;

    const confirmed = await triggerConfirmation(
      destroys
        ? {
            title: `Delete "${name}"?`,
            description:
              "This is the only copy, so deleting it here deletes it for good.",
          }
        : {
            title: `Remove "${name}" from this project?`,
            description:
              "This only takes it out of this project. The item itself is not deleted and stays wherever it lives.",
          },
    );

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

  return (
    <BlockStack gap="4">
      <ColumnHeadingRow>
        <Heading level={2}>Resources</Heading>
        <AddResourceMenu projectId={projectId} />
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
              <TableRow className="hover:bg-transparent">
                <TableHead
                  colSpan={COLUMN_COUNT}
                  scope="rowgroup"
                  className="px-2 pt-4"
                >
                  <InlineStack gap="1" blockAlign="center" wrap="nowrap">
                    <Icon
                      name={entityIcon(entity)}
                      size="xs"
                      className="shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Text size="xs" tone="subdued">
                      {groupHeading(entity, items.length)}
                    </Text>
                  </InlineStack>
                </TableHead>
              </TableRow>

              {items.map((resource) => (
                <ResourceRow
                  key={resource.id}
                  resource={resource}
                  selected={resource.id === selectedResourceId}
                  onSelect={(picked) =>
                    onSelect(
                      picked.id === selectedResourceId ? null : picked.id,
                    )
                  }
                  onRemove={handleRemove}
                />
              ))}
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
