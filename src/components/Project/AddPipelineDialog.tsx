import { useEffect, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { pointerTo } from "@/services/localPipelines/localPipelinesService";
import {
  useLocalPipelineNames,
  useResolvedPointers,
} from "@/services/localPipelines/useLocalPipelines";
import {
  DescriptorTooLargeError,
  localPipelinePointerOf,
  localPipelineResourceInput,
} from "@/services/projects/resourceDescriptor";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";
import { tracking } from "@/utils/tracking";

interface AddPipelineDialogProps {
  projectId: string;
  resources: ProjectResourceSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPipelineDialog({
  projectId,
  resources,
  open,
  onOpenChange,
}: AddPipelineDialogProps) {
  const [query, setQuery] = useState("");
  const { data: names, isPending, error } = useLocalPipelineNames();
  const createResource = useCreateProjectResource(projectId);
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const pointers = resources
    .map((resource) => localPipelinePointerOf(resource))
    .filter((pointer) => pointer !== undefined);
  const { data: resolved } = useResolvedPointers(pointers);

  /**
   * A pointer records the name a pipeline had when it was added, so a renamed
   * pipeline is listed here under a name no pointer mentions. Matching what
   * each pointer resolves to as well is what stops it being added twice.
   */
  const alreadyAdded = new Set([
    ...pointers.map((pointer) => pointer.localName),
    ...Object.values(resolved ?? {}).filter((name) => name !== null),
  ]);

  useEffect(() => {
    if (open) {
      track("projects.add_pipeline_dialog_impression");
    }
  }, [open, track]);

  const close = () => {
    setQuery("");
    onOpenChange(false);
  };

  const add = async (name: string) => {
    let input;
    try {
      input = localPipelineResourceInput(await pointerTo(name));
    } catch (problem) {
      notify(
        problem instanceof DescriptorTooLargeError
          ? problem.message
          : "Could not add that pipeline",
        "error",
      );
      return;
    }

    createResource.mutate(input, {
      onSuccess: () => {
        track("projects.add_pipeline_completed");
        notify("Pipeline added", "success");
        close();
      },
    });
  };

  const matches = (names ?? []).filter((name) =>
    name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="flex max-h-[80vh] flex-col">
        <DialogHeader>
          <DialogTitle>Add a pipeline</DialogTitle>
        </DialogHeader>

        <BlockStack gap="4" className="min-h-0">
          <Text size="sm" tone="subdued">
            Pipelines are stored in this browser, so a project can name one but
            cannot share it.
          </Text>

          {names && names.length > 0 && (
            <div className="relative">
              <Icon
                name="Search"
                size="sm"
                className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onEscape={() => setQuery("")}
                placeholder="Search pipelines"
                aria-label="Search pipelines"
                className="pl-7"
                autoFocus
              />
            </div>
          )}

          {isPending && (
            <InlineStack gap="2" blockAlign="center">
              <Spinner /> Loading...
            </InlineStack>
          )}

          {error && (
            <InfoBox title="Error loading pipelines" variant="error">
              {error.message}
            </InfoBox>
          )}

          {names && names.length === 0 && (
            <EmptyState
              icon="GitBranch"
              placement="start"
              title="No pipelines in this browser"
              description="Build a pipeline in the editor and it will show up here."
            />
          )}

          {names && names.length > 0 && matches.length === 0 && (
            <Text size="sm" tone="subdued">
              No pipelines match that.
            </Text>
          )}

          <BlockStack gap="1" className="min-h-0 flex-1 overflow-y-auto">
            {matches.map((name) => (
              <Button
                key={name}
                variant="ghost"
                className="h-auto w-full justify-start py-2"
                disabled={alreadyAdded.has(name) || createResource.isPending}
                onClick={() => add(name)}
                {...tracking("projects.add_pipeline_select")}
              >
                <InlineStack
                  gap="2"
                  blockAlign="center"
                  wrap="nowrap"
                  className="w-full"
                >
                  <Icon name="GitBranch" size="xs" className="shrink-0" />
                  <Text size="sm" className="flex-1 truncate text-left">
                    {name}
                  </Text>
                  {alreadyAdded.has(name) && (
                    <Text size="xs" tone="subdued">
                      Added
                    </Text>
                  )}
                </InlineStack>
              </Button>
            ))}
          </BlockStack>
        </BlockStack>

        <DialogFooter className="w-full">
          <InlineStack gap="2" className="w-full" align="end">
            <Button
              variant="outline"
              onClick={close}
              {...tracking("projects.add_pipeline_cancel")}
            >
              Cancel
            </Button>
          </InlineStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
