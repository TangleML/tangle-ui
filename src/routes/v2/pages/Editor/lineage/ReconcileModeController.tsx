import { useNavigate } from "@tanstack/react-router";
import { NodeToolbar, Position } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { hydrateComponentReference } from "@/services/componentService";

import { collectLineageUsages } from "./collectLineageUsages";
import { findTaskContext } from "./findTaskContext";
import { reconcileModeStore } from "./reconcileModeStore";

/**
 * Drives the in-canvas reconcile experience when reconcile mode is active:
 * holds autosave, stages the edited component onto matching tasks in-memory
 * (rendered immediately, fully undoable), spotlights them, and surfaces a
 * node-anchored "Finish Reconciling" button (the explicit commit) plus a banner.
 *
 * Rendered inside `<ReactFlow>` so `NodeToolbar` can anchor to the target nodes.
 * Nothing is persisted until Finish; Cancel / leaving discards the staged change
 * (the pipeline reloads fresh from storage).
 */
export const ReconcileModeController = observer(
  function ReconcileModeController() {
    const session = reconcileModeStore.session;
    const spec = useSpec();
    const navigate = useNavigate();
    const { autoSave, undo } = useEditorSession();
    const { replaceTask } = useTaskActions();
    const { editor } = useSharedStores();

    const [ready, setReady] = useState(false);
    const [matchTaskIds, setMatchTaskIds] = useState<string[]>([]);
    const stagedSessionRef = useRef<string | null>(null);

    useEffect(() => {
      if (!session) {
        stagedSessionRef.current = null;
        setReady(false);
        setMatchTaskIds([]);
      }
    }, [session]);

    useEffect(() => {
      if (!session || !spec) return;
      if (stagedSessionRef.current === session.sessionId) return;

      let cancelled = false;
      void (async () => {
        const component = await hydrateComponentReference({
          text: session.targetComponentText,
        });
        if (cancelled || !component) return;

        const matches = collectLineageUsages(spec, session.originId).filter(
          (m) => m.digest !== session.targetDigest,
        );

        stagedSessionRef.current = session.sessionId;

        if (matches.length > 0) {
          autoSave.setSuspended(true);
          undo.withGroup("Reconcile component", () => {
            for (const match of matches) {
              const ctx = findTaskContext(spec, match.taskId);
              if (ctx) replaceTask(ctx.spec, match.taskId, component);
            }
          });
          editor.setPendingFocusNode(matches[0].taskId);
          editor.setSpotlightNode(matches[0].taskId);
        }

        if (!cancelled) {
          setMatchTaskIds(matches.map((m) => m.taskId));
          setReady(true);
        }
      })();

      return () => {
        cancelled = true;
      };
      // Stage once per session; deps kept stable intentionally.
    }, [session?.sessionId, spec]);

    if (!session || !ready) return null;

    const returnToOverview = () =>
      navigate({
        to: APP_ROUTES.EDITOR_V2_PIPELINE,
        params: { pipelineName: session.returnToPipeline },
        search: { reconcileOverview: session.sessionId },
      });

    const finish = async () => {
      autoSave.setSuspended(false);
      await autoSave.save();
      reconcileModeStore.exit();
      await returnToOverview();
    };

    const leave = async () => {
      // Leave without saving — the staged change is discarded on reload.
      reconcileModeStore.exit();
      await returnToOverview();
    };

    const count = matchTaskIds.length;

    return (
      <>
        {count > 0 && (
          <NodeToolbar
            nodeId={matchTaskIds}
            isVisible
            position={Position.Top}
            offset={12}
          >
            <Button size="sm" onClick={() => void finish()}>
              <Icon name="Check" size="sm" />
              Finish Reconciling{count > 1 ? ` (${count} tasks)` : ""}
            </Button>
          </NodeToolbar>
        )}

        <div className="fixed left-1/2 top-3 z-[60] -translate-x-1/2">
          <InlineStack
            gap="3"
            blockAlign="center"
            className="rounded-full border bg-white px-4 py-1.5 shadow-md"
          >
            <Icon name="RefreshCw" size="sm" className="text-blue-600" />
            {count > 0 ? (
              <Text size="sm">
                Reconciling <strong>{session.targetName}</strong> · {count}{" "}
                {count === 1 ? "task" : "tasks"} staged
              </Text>
            ) : (
              <Text size="sm">Nothing to reconcile in this pipeline</Text>
            )}
            <Button size="sm" variant="ghost" onClick={() => void leave()}>
              {count > 0 ? "Cancel" : "Back"}
            </Button>
          </InlineStack>
        </div>
      </>
    );
  },
);
