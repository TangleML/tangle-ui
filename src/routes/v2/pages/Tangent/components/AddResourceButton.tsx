import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RUN_FILTER_SEARCH_PARAM } from "@/hooks/useRunSearchParams";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import type { DialogConfig } from "@/providers/DialogProvider/types";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { AddDocumentDialog } from "@/routes/v2/pages/Tangent/components/AddDocumentDialog";
import { AddPipelineDialog } from "@/routes/v2/pages/Tangent/components/AddPipelineDialog";
import { AddPipelineRunDialog } from "@/routes/v2/pages/Tangent/components/AddPipelineRunDialog";
import { LinkRepositoryDialog } from "@/routes/v2/pages/Tangent/components/LinkRepositoryDialog";
import type { LocalPipelinePointer } from "@/services/localPipelines/types";
import { localPipelinePointerOf } from "@/services/projects/resourceDescriptor";
import type {
  CreateResourceInput,
  ProjectResourceSummary,
} from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";
import { tracking } from "@/utils/tracking";

export type AddableKind = "pipeline" | "run" | "document" | "repository";

interface AddResourceButtonProps {
  projectId: string;
  resources: ProjectResourceSummary[];
  kind: AddableKind;
  disabled?: boolean;
}

const ADDABLE: Record<AddableKind, { label: string; trackingId: string }> = {
  pipeline: {
    label: "Add a pipeline",
    trackingId: "projects.add_pipeline_open",
  },
  run: {
    label: "Add a pipeline run",
    trackingId: "projects.add_pipeline_run_open",
  },
  document: {
    label: "Add a document",
    trackingId: "projects.add_document_open",
  },
  repository: {
    label: "Link a repository",
    trackingId: "projects.link_repository_open",
  },
};

type ResourceDialogConfig<TProps> = DialogConfig<
  CreateResourceInput,
  TProps
> & {
  onSuccess?: () => void;
};

function identityOf(metadata: Record<string, unknown> | null | undefined) {
  const identity = metadata?.identity;
  return typeof identity === "string" ? identity : undefined;
}

function samePipeline(a: LocalPipelinePointer, b: LocalPipelinePointer) {
  return a.localId && b.localId
    ? a.localId === b.localId
    : a.localName === b.localName;
}

/**
 * A pipeline attached before it had a registry row is recorded by name, so
 * comparing identity strings alone reads the picker's id as a different
 * pipeline and attaches the same one a second time.
 */
function alreadyHolds(
  resources: ProjectResourceSummary[],
  pick: CreateResourceInput,
): boolean {
  if (pick.entity === "pipeline" && pick.entityId) {
    return resources.some(
      (resource) =>
        resource.entity === "pipeline" && resource.entityId === pick.entityId,
    );
  }

  const metadata = pick.metadata ?? null;

  const pointer = localPipelinePointerOf({ metadata });
  if (pointer) {
    return resources.some((resource) => {
      const attached = localPipelinePointerOf(resource);
      return attached !== undefined && samePipeline(attached, pointer);
    });
  }

  const identity = identityOf(metadata);
  return (
    identity !== undefined &&
    resources.some((resource) => identityOf(resource.metadata) === identity)
  );
}

export function AddResourceButton({
  projectId,
  resources,
  kind,
  disabled = false,
}: AddResourceButtonProps) {
  const { open } = useDialog();
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const { mutate: createResource, isPending } =
    useCreateProjectResource(projectId);

  async function openResourceDialog<TProps = {}>({
    onSuccess,
    ...config
  }: ResourceDialogConfig<TProps>) {
    const result = await open<CreateResourceInput, TProps>({
      size: "full",
      ...config,
    }).catch(convertCancelErrorTo(undefined));

    if (!result) return;

    if (alreadyHolds(resources, result)) {
      notify(`${result.name ?? "That"} is already in this project`, "info");
      return;
    }

    createResource(result, { onSuccess });
  }

  function handleAddPipeline() {
    void openResourceDialog({
      component: AddPipelineDialog,
      routeKey: "add-pipeline",
    });
  }

  function handleAddPipelineRun() {
    void openResourceDialog({
      component: AddPipelineRunDialog,
      routeKey: "add-pipeline-run",
      clearSearchParamsOnClose: [RUN_FILTER_SEARCH_PARAM],
    });
  }

  // The pipeline and run pickers are browsers and want the whole screen; a
  // document editor wants width, but lines that span a wide monitor read badly.
  function handleAddDocument() {
    void openResourceDialog({
      component: AddDocumentDialog,
      routeKey: "add-document",
      size: "xl",
    });
  }

  function handleLinkRepository() {
    void openResourceDialog({
      component: LinkRepositoryDialog,
      props: { resources },
      routeKey: "link-repository",
      size: "md",
      onSuccess: () => track("projects.link_repository_completed"),
    });
  }

  const add: Record<AddableKind, () => void> = {
    pipeline: handleAddPipeline,
    run: handleAddPipelineRun,
    document: handleAddDocument,
    repository: handleLinkRepository,
  };
  const { label, trackingId } = ADDABLE[kind];

  return (
    <Button
      variant="subtle"
      size="icon-xs"
      aria-label={label}
      title={label}
      disabled={disabled || isPending}
      onClick={add[kind]}
      {...tracking(trackingId)}
    >
      <Icon name="Plus" size="sm" />
    </Button>
  );
}
