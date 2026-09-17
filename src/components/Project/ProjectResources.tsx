import { useState } from "react";

import { ENTITY_ORDER } from "@/components/Home/ProjectsSection/formatResourceCounts";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { ProjectResourceSummary } from "@/services/projects/types";
import {
  useDeleteProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";
import { tracking } from "@/utils/tracking";

import { AddResourceMenu } from "./AddResourceMenu";
import { ResourceCard, UNTITLED } from "./ResourceCard";
import { entityLabel } from "./resourceEntities";

const PAGE_SIZE = 100;

const ALL = "all";

function entitiesPresent(resources: ProjectResourceSummary[]) {
  const counts = new Map<string, number>();
  for (const resource of resources) {
    counts.set(resource.entity, (counts.get(resource.entity) ?? 0) + 1);
  }

  const known = ENTITY_ORDER.filter((entity) => counts.has(entity));
  const unknown = [...counts.keys()]
    .filter((entity) => !ENTITY_ORDER.includes(entity))
    .sort();

  return [...known, ...unknown].map((entity) => ({
    entity,
    count: counts.get(entity) ?? 0,
  }));
}

interface ProjectResourcesProps {
  projectId: string;
}

export function ProjectResources({ projectId }: ProjectResourcesProps) {
  const [filter, setFilter] = useState(ALL);

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
    const confirmed = await triggerConfirmation({
      title: `Remove "${resource.name ?? UNTITLED}" from this project?`,
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

  const resources = data?.items ?? [];
  const kinds = entitiesPresent(resources);
  const shown =
    filter === ALL
      ? resources
      : resources.filter((resource) => resource.entity === filter);

  return (
    <BlockStack gap="4">
      <InlineStack gap="3" blockAlign="center">
        <Heading level={2}>Resources</Heading>
        <AddResourceMenu projectId={projectId} />
      </InlineStack>

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
          description="Add a document to keep notes and context alongside the work. Pipelines and agent sessions can be added once that is built."
        />
      )}

      {data && resources.length > 0 && (
        <BlockStack gap="3">
          {kinds.length > 1 && (
            <InlineStack gap="2" blockAlign="center" wrap="wrap">
              <FilterPill
                label={`All ${resources.length}`}
                active={filter === ALL}
                onSelect={() => setFilter(ALL)}
              />
              {kinds.map(({ entity, count }) => (
                <FilterPill
                  key={entity}
                  label={`${entityLabel(entity)} ${count}`}
                  active={filter === entity}
                  onSelect={() => setFilter(entity)}
                />
              ))}
            </InlineStack>
          )}

          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
            {shown.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </BlockStack>
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

interface FilterPillProps {
  label: string;
  active: boolean;
  onSelect: () => void;
}

function FilterPill({ label, active, onSelect }: FilterPillProps) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onSelect}
      aria-pressed={active}
      className="capitalize"
      {...tracking("projects.filter_resources")}
    >
      {label}
    </Button>
  );
}
