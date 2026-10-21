import { useRouter, useRouterState } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/appRoutes";
import { readProjectIdParam } from "@/routes/projectRunSearch";
import type { RemotePipelineNodeType } from "@/routes/remotePipelineSearch";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

interface RemotePipelineNodeLinkButtonProps {
  pipelineId: string;
  nodeName: string;
  nodeType: RemotePipelineNodeType;
  disabled?: boolean;
}

export function RemotePipelineNodeLinkButton({
  pipelineId,
  nodeName,
  nodeType,
  disabled = false,
}: RemotePipelineNodeLinkButtonProps) {
  const router = useRouter();
  const { navigation } = useSharedStores();
  const notify = useToastNotification();

  const copyLink = async () => {
    if (disabled) return;
    const subgraphPath = navigation.navigationPath
      .slice(1)
      .map((entry) => entry.displayName);
    const location = router.buildLocation({
      to: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
      params: { pipelineId },
      search: {
        projectId: readProjectIdParam(router.state.location.search),
        subgraphPath: subgraphPath.length ? subgraphPath : undefined,
        nodeId: nodeName,
        nodeType,
      },
    });
    const link = new URL(
      router.history.createHref(location.href),
      window.location.href,
    );

    try {
      await navigator.clipboard.writeText(link.toString());
      notify("Link copied to clipboard", "success");
    } catch {
      notify("Unable to copy node link", "error");
    }
  };

  return (
    <ActionButton
      tooltip={
        disabled
          ? "Node links are available once changes are saved"
          : "Copy node link"
      }
      disabled={disabled}
      aria-label="Copy node link"
      icon="Link"
      onClick={() => void copyLink()}
    />
  );
}

interface EditorNodeLinkButtonProps {
  entityId: string;
  nodeType: RemotePipelineNodeType;
}

export const EditorNodeLinkButton = observer(function EditorNodeLinkButton({
  entityId,
  nodeType,
}: EditorNodeLinkButtonProps) {
  const { pipelineFile, autoSave } = useEditorSession();
  const params = useRouterState({
    select: (state) => state.matches.at(-1)?.params,
  });
  const { navigation } = useSharedStores();
  const file = pipelineFile.activePipelineFile;
  const spec = navigation.activeSpec;
  const nodes =
    nodeType === "task"
      ? spec?.tasks
      : nodeType === "input"
        ? spec?.inputs
        : spec?.outputs;
  const node = nodes?.find((entity) => entity.$id === entityId);

  if (
    !file?.remote ||
    !node ||
    !params ||
    !("pipelineId" in params) ||
    params.pipelineId !== file.id
  )
    return null;

  return (
    <RemotePipelineNodeLinkButton
      pipelineId={file.id}
      disabled={
        autoSave.isSaving ||
        autoSave.hasUnsavedChanges ||
        Boolean(autoSave.error)
      }
      nodeName={node.name}
      nodeType={nodeType}
    />
  );
});
