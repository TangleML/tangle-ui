import type { ComponentProps } from "react";

import type ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { UNTITLED } from "@/services/projects/placeholderNames";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { useDeleteProjectResource } from "@/services/projects/useProjectResources";

import { removalConsequence, removingDestroys } from "./resourceEntities";

interface ConfirmedResourceRemoval {
  confirmAndRemove: (resource: ProjectResourceSummary) => Promise<void>;
  isRemoving: boolean;
  confirmation: ComponentProps<typeof ConfirmationDialog>;
}

interface ResourceRemovalOptions {
  projectId: string;
  trackingEvent: string;
  onRemoved?: (resource: ProjectResourceSummary) => void;
}

/**
 * Detaching a resource is offered from the project's resource table and from
 * the run submitter's project picker, and both have to say the same thing about
 * what it costs — for a browser-held pipeline, detaching is the only record of
 * it going, and for a document the payload goes with the row.
 *
 * The caller renders `<ConfirmationDialog {...confirmation} />` where its layout
 * suits, and says in `onRemoved` what its own surface has to forget afterwards.
 */
export function useConfirmedResourceRemoval({
  projectId,
  trackingEvent,
  onRemoved,
}: ResourceRemovalOptions): ConfirmedResourceRemoval {
  const removeResource = useDeleteProjectResource(projectId);
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const { handlers, triggerDialog, ...confirmationProps } =
    useConfirmationDialog();

  const confirmAndRemove = async (resource: ProjectResourceSummary) => {
    const destroys = removingDestroys(resource);
    const name = resource.name ?? UNTITLED;

    const confirmed = await triggerDialog({
      title: destroys
        ? `Delete "${name}"?`
        : `Remove "${name}" from this project?`,
      description: removalConsequence(resource),
    });

    if (!confirmed) return;

    removeResource.mutate(resource.id, {
      onSuccess: () => {
        track(trackingEvent, {
          entity: resource.entity,
          destroyed: destroys,
        });
        notify(destroys ? "Deleted" : "Removed from project", "success");
        onRemoved?.(resource);
      },
    });
  };

  return {
    confirmAndRemove,
    isRemoving: removeResource.isPending,
    confirmation: {
      ...confirmationProps,
      onConfirm: () => handlers?.onConfirm(),
      onCancel: () => handlers?.onCancel(),
    },
  };
}
