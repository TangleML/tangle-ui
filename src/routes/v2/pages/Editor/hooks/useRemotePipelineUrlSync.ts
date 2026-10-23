import { useRouter, useRouterState } from "@tanstack/react-router";
import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import type { ComponentSpec } from "@/models/componentSpec";
import { APP_ROUTES } from "@/routes/appRoutes";
import {
  type RemotePipelineNodeType,
  validateRemotePipelineSearch,
} from "@/routes/remotePipelineSearch";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

function resolveNode(
  spec: ComponentSpec,
  name: string,
  type?: RemotePipelineNodeType,
) {
  const candidates = [
    { type: "task", entities: spec.tasks },
    { type: "input", entities: spec.inputs },
    { type: "output", entities: spec.outputs },
  ] satisfies {
    type: RemotePipelineNodeType;
    entities: { $id: string; name: string }[];
  }[];

  for (const candidate of candidates) {
    if (type && candidate.type !== type) continue;
    const entity = candidate.entities.find((entity) => entity.name === name);
    if (entity) return { id: entity.$id, type: candidate.type };
  }
  return undefined;
}

export function useRemotePipelineUrlSync(
  rootSpec: ComponentSpec,
  pipelineId: string | undefined,
): void {
  const router = useRouter();
  const notify = useToastNotification();
  const notifiedHref = useRef<string | null>(null);
  const match = useRouterState({ select: (state) => state.matches.at(-1) });
  const { navigation, editor } = useSharedStores();

  useEffect(() => {
    if (
      !pipelineId ||
      !match ||
      !("pipelineId" in match.params) ||
      match.params.pipelineId !== pipelineId ||
      navigation.rootSpec !== rootSpec
    )
      return;

    const search = validateRemotePipelineSearch(match.search);
    const requestedPath = search.subgraphPath ?? [];
    const path: string[] = [];
    let spec = rootSpec;
    for (const name of requestedPath) {
      const child = spec.tasks.find((task) => task.name === name)?.subgraphSpec;
      if (!child) break;
      path.push(name);
      spec = child;
    }

    const currentPath = navigation.navigationPath
      .slice(1)
      .map((entry) => entry.displayName);
    if (JSON.stringify(path) !== JSON.stringify(currentPath)) {
      editor.setPendingFocusNode(null);
      navigation.navigateToPath([rootSpec.name, ...path]);
    }

    const validPath = path.length === requestedPath.length;
    const node =
      validPath && search.nodeId !== undefined
        ? resolveNode(spec, search.nodeId, search.nodeType)
        : undefined;
    if (search.nodeId !== undefined) {
      editor.clearSelection();
      editor.setPendingFocusNode(null);
      if (node) {
        editor.selectNode(node.id, node.type);
        editor.setPendingFocusNode(node.id);
      }
    }

    const remotePipelineId = pipelineId;
    function navigateToPath(nextPath: string[], replace: boolean) {
      void router.navigate({
        to: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
        params: { pipelineId: remotePipelineId },
        search: (previous) => ({
          ...previous,
          subgraphPath: nextPath.length ? nextPath : undefined,
          nodeId: undefined,
          nodeType: undefined,
        }),
        replace,
        resetScroll: false,
      });
    }

    if (
      !validPath ||
      (search.nodeId !== undefined && !node) ||
      (search.nodeType !== undefined && search.nodeId === undefined)
    ) {
      if (notifiedHref.current !== router.state.location.href) {
        notifiedHref.current = router.state.location.href;
        notify(
          !validPath
            ? "The linked subgraph is no longer in this pipeline. Opened its nearest available parent."
            : "The linked node is no longer in this pipeline.",
          "warning",
        );
      }
      navigateToPath(path, true);
    } else {
      notifiedHref.current = null;
    }

    return reaction(
      () => ({
        path: navigation.navigationPath.map((entry) => entry.displayName),
        nodeId: editor.selectedNodeId,
        nodeType: editor.selectedNodeType,
      }),
      ({ path: nextPath, nodeId, nodeType }, { path: previousPath }) => {
        // Lifecycle cleanup clears navigation before disposing this reaction.
        if (!nextPath.length || navigation.rootSpec !== rootSpec) return;
        const nestedPath = nextPath.slice(1);
        if (
          JSON.stringify(nestedPath) === JSON.stringify(previousPath.slice(1))
        ) {
          if (
            search.nodeId !== undefined &&
            (nodeId !== node?.id || nodeType !== node?.type)
          )
            navigateToPath(nestedPath, true);
          return;
        }
        let previousSpec: ComponentSpec | undefined = rootSpec;
        for (const name of previousPath.slice(1)) {
          previousSpec = previousSpec?.tasks.find(
            (task) => task.name === name,
          )?.subgraphSpec;
        }
        navigateToPath(nestedPath, !previousSpec);
      },
    );
  }, [router, match, rootSpec, pipelineId, navigation, editor, notify]);
}
