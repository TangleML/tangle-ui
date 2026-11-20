import { type ComponentProps, useState } from "react";

import type ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import type { IconName } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { RepositoryLocation } from "@/services/github/repositoryUrl";
import { linkedRepositoryOf } from "@/services/projects/resourceDescriptor";
import type { ProjectResource } from "@/services/projects/types";
import { useUpdateProjectResource } from "@/services/projects/useProjectResources";

import { PUBLIC_WRITES_WARNING } from "./AgentWritesField";

export interface RepositoryWritesAction {
  icon: IconName;
  label: string;
  trackingId: string;
}

export function repositoryWritesAction(
  repository: RepositoryLocation,
  name: string,
): RepositoryWritesAction {
  return repository.allowWrites
    ? {
        icon: "PenOff",
        label: `Stop agent writes to ${name}`,
        trackingId: "projects.repository_stop_writes",
      }
    : {
        icon: "PenLine",
        label: `Allow agent writes to ${name}`,
        trackingId: "projects.repository_allow_writes",
      };
}

interface RepositoryWritesToggle {
  toggle: (resource: ProjectResource) => void;
  isPending: boolean;
  confirmation: ComponentProps<typeof ConfirmationDialog>;
}

/**
 * Turning writes on for a public repository asks first: the agent's pull
 * requests, issues and comments there are public the moment they are made.
 * Turning them off, or on for a private repository, needs no confirmation.
 */
export function useRepositoryWritesToggle(
  projectId: string,
): RepositoryWritesToggle {
  const updateResource = useUpdateProjectResource(projectId);
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const [awaitingConfirmation, setAwaitingConfirmation] =
    useState<ProjectResource | null>(null);

  const apply = (
    resource: ProjectResource,
    repository: RepositoryLocation,
    allowWrites: boolean,
  ) => {
    updateResource.mutate(
      {
        resourceId: resource.id,
        input: { payload: { ...resource.payload, allowWrites } },
      },
      {
        onSuccess: () => {
          track("projects.repository_writes_completed", {
            allowed: allowWrites,
            private: repository.isPrivate,
          });
          notify(
            allowWrites
              ? "Agents can now write to this repository"
              : "Agents can no longer write to this repository",
            "success",
          );
        },
      },
    );
  };

  const toggle = (resource: ProjectResource) => {
    const repository = linkedRepositoryOf(resource);
    if (!repository) return;

    if (repository.allowWrites || repository.isPrivate) {
      apply(resource, repository, !repository.allowWrites);
      return;
    }
    setAwaitingConfirmation(resource);
  };

  const confirm = () => {
    if (!awaitingConfirmation) return;
    const repository = linkedRepositoryOf(awaitingConfirmation);
    setAwaitingConfirmation(null);
    if (repository) apply(awaitingConfirmation, repository, true);
  };

  return {
    toggle,
    isPending: updateResource.isPending,
    confirmation: {
      isOpen: awaitingConfirmation !== null,
      title: "Allow agents to write to this public repository?",
      description: PUBLIC_WRITES_WARNING,
      confirmLabel: "Allow writes",
      onConfirm: confirm,
      onCancel: () => setAwaitingConfirmation(null),
    },
  };
}
