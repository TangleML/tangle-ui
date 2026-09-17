import {
  ENTITY_ORDER,
  pluralize,
} from "@/components/Home/ProjectsSection/formatResourceCounts";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
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
import { formatDate } from "@/utils/date";

const PAGE_SIZE = 100;

const UNTITLED = "Untitled";

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

function groupByEntity(resources: ProjectResourceSummary[]) {
  const grouped = new Map<string, ProjectResourceSummary[]>();
  for (const entity of ENTITY_ORDER) {
    grouped.set(entity, []);
  }
  for (const resource of resources) {
    const existing = grouped.get(resource.entity);
    if (existing) {
      existing.push(resource);
    } else {
      grouped.set(resource.entity, [resource]);
    }
  }
  return grouped;
}

interface ProjectContentsProps {
  projectId: string;
}

export function ProjectContents({ projectId }: ProjectContentsProps) {
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
    const label = resource.name ?? UNTITLED;
    const confirmed = await triggerConfirmation({
      title: `Remove "${label}" from this project?`,
      description:
        "This takes the item out of the project. It does not delete what the item points at.",
    });

    if (!confirmed) return;

    removeResource.mutate(resource.id, {
      onSuccess: () => {
        track("projects.remove_resource_completed", {
          entity: resource.entity,
        });
        notify("Removed from project", "success");
      },
    });
  };

  return (
    <BlockStack gap="4">
      <Heading level={2}>Contents</Heading>

      {isPending && (
        <InlineStack gap="2" blockAlign="center">
          <Spinner /> Loading...
        </InlineStack>
      )}

      {error && (
        <InfoBox title="Error loading contents" variant="error">
          {error.message}
        </InfoBox>
      )}

      {data &&
        [...groupByEntity(data.items)].map(([entity, resources]) => (
          <EntityGroup
            key={entity}
            entity={entity}
            resources={resources}
            onRemove={handleRemove}
          />
        ))}

      {data?.nextPageToken && (
        <Text size="sm" tone="subdued">
          {`Showing the first ${data.items.length} of ${data.totalCount} items.`}
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

interface EntityGroupProps {
  entity: string;
  resources: ProjectResourceSummary[];
  onRemove: (resource: ProjectResourceSummary) => void;
}

function EntityGroup({ entity, resources, onRemove }: EntityGroupProps) {
  const heading = capitalize(pluralize(entity, resources.length));

  return (
    <BlockStack gap="2">
      <Heading level={3}>
        {resources.length === 0 ? heading : `${heading} (${resources.length})`}
      </Heading>

      {resources.length === 0 ? (
        <Text size="sm" tone="subdued">
          Nothing here yet
        </Text>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((resource) => (
              <TableRow key={resource.id}>
                <TableCell>
                  {resource.name ? (
                    <Text>{resource.name}</Text>
                  ) : (
                    <Text tone="subdued">{UNTITLED}</Text>
                  )}
                </TableCell>
                <TableCell>
                  <Text tone="subdued">{formatDate(resource.createdAt)}</Text>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Item actions: ${resource.name ?? UNTITLED}`}
                      >
                        <Icon name="EllipsisVertical" size="sm" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => onRemove(resource)}
                      >
                        <Icon name="Trash2" size="sm" />
                        Remove from project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </BlockStack>
  );
}
