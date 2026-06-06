import { useNavigate } from "@tanstack/react-router";
import { NodeToolbar, Position } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { hydrateComponentReference } from "@/services/componentService";

/**
 * Walk a subgraph path (array of task names), calling navigateToSubgraph at
 * each level. MobX updates navigation.activeSpec synchronously after each call,
 * so reading it in the next iteration gives the correct deeper spec.
 */
function navigateToSubgraphPath(
  navigation: NavigationStore,
  path: string[],
): void {
  for (const taskName of path) {
    const currentSpec = navigation.activeSpec;
    if (!currentSpec) break;
    const task = currentSpec.tasks.find((t) => t.name === taskName);
    if (task?.subgraphSpec) {
      navigation.navigateToSubgraph(currentSpec, task.$id);
    }
  }
}

import { collectLineageUsages } from "./collectLineageUsages";
import { findTaskContext } from "./findTaskContext";
import { reconcileModeStore } from "./reconcileModeStore";

/**
 * Drives the in-canvas reconcile experience when reconcile mode is active.
 *
 * All matching tasks are staged simultaneously (in-memory, nothing persisted).
 * The user reviews them one at a time — each has a "Mark Done" button that
 * works like a checkbox. Previous/Next navigate freely. When every task is
 * marked done the pipeline is saved and the user returns to the overview.
 * Cancel discards all staged changes.
 *
 * Issue 4 fix: stagedSessionRef is explicitly cleared in leave() to prevent
 * "Nothing to reconcile" on re-entry when the same FlowCanvas key is reused
 * (i.e. the same pipeline is navigated to a second time without re-mounting).
 */
export const ReconcileModeController = observer(
  function ReconcileModeController() {
    const session = reconcileModeStore.session;
    const spec = useSpec();
    const navigate = useNavigate();
    const { autoSave, undo } = useEditorSession();
    const { replaceTask } = useTaskActions();
    const { editor, navigation } = useSharedStores();

    const [ready, setReady] = useState(false);
    const [matchTaskIds, setMatchTaskIds] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    // Checkbox model: every task must be marked before finishing.
    const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set());
    const stagedSessionRef = useRef<string | null>(null);

    useEffect(() => {
      if (!session) {
        stagedSessionRef.current = null;
        setReady(false);
        setMatchTaskIds([]);
        setCurrentIndex(0);
        setDoneTaskIds(new Set());
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

        navigateToSubgraphPath(navigation, session.targetSubgraphPath ?? []);
        const targetSpec = navigation.activeSpec ?? spec;

        const matches = collectLineageUsages(
          targetSpec,
          session.originId,
        ).filter((m) => m.digest !== session.targetDigest);

        stagedSessionRef.current = session.sessionId;

        if (matches.length > 0) {
          autoSave.setSuspended(true);
          undo.withGroup("Reconcile component", () => {
            for (const match of matches) {
              const ctx = findTaskContext(targetSpec, match.taskId);
              if (ctx) replaceTask(ctx.spec, match.taskId, component);
            }
          });
          editor.setPendingFocusNode(matches[0].taskId);
          editor.setSpotlightNode(matches[0].taskId);
          editor.selectNode(matches[0].taskId, "task");
          reconcileModeStore.setCurrentReconcileTaskId(matches[0].taskId);
        }

        if (!cancelled) {
          setMatchTaskIds(matches.map((m) => m.taskId));
          setCurrentIndex(0);
          setDoneTaskIds(new Set());
          setReady(true);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [session?.sessionId, spec]);

    if (!session || !ready) return null;

    const count = matchTaskIds.length;
    const currentTaskId = matchTaskIds[currentIndex] ?? null;
    const doneCount = doneTaskIds.size;
    const allDone = doneCount === count && count > 0;
    const currentIsDone = currentTaskId
      ? doneTaskIds.has(currentTaskId)
      : false;

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
      // Clear stagedSessionRef so re-entering reconcile mode for the same
      // pipeline will re-run staging (the FlowCanvas key may not change).
      stagedSessionRef.current = null;
      reconcileModeStore.exit();
      await returnToOverview();
    };

    const goTo = (index: number) => {
      const clamped = Math.max(0, Math.min(index, count - 1));
      setCurrentIndex(clamped);
      const taskId = matchTaskIds[clamped];
      if (taskId) {
        editor.setPendingFocusNode(taskId);
        editor.setSpotlightNode(taskId);
        editor.selectNode(taskId, "task");
        reconcileModeStore.setCurrentReconcileTaskId(taskId);
      }
    };

    /** Find the next task that hasn't been marked done, searching forward. */
    const findNextUndone = (fromIndex: number): number | null => {
      for (let i = 1; i < count; i++) {
        const idx = (fromIndex + i) % count;
        if (!doneTaskIds.has(matchTaskIds[idx])) return idx;
      }
      return null;
    };

    const toggleDone = () => {
      if (!currentTaskId) return;
      const newDone = new Set(doneTaskIds);

      if (currentIsDone) {
        // Unmark — user changed their mind.
        newDone.delete(currentTaskId);
        setDoneTaskIds(newDone);
      } else {
        // Mark done.
        newDone.add(currentTaskId);
        setDoneTaskIds(newDone);

        if (newDone.size === count) {
          // All tasks reviewed — finish.
          void finish();
        } else {
          // Advance to the next undone task.
          const nextIdx = findNextUndone(currentIndex);
          if (nextIdx !== null) goTo(nextIdx);
        }
      }
    };

    return (
      <>
        {currentTaskId && (
          <NodeToolbar
            nodeId={currentTaskId}
            isVisible
            position={Position.Top}
            offset={12}
          >
            <InlineStack gap="1" blockAlign="center">
              {count > 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="min"
                      className="h-8 w-8"
                      disabled={currentIndex === 0}
                      onClick={() => goTo(currentIndex - 1)}
                    >
                      <Icon name="ChevronLeft" size="sm" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous task</TooltipContent>
                </Tooltip>
              )}

              {count === 1 ? (
                <Button size="sm" onClick={() => void finish()}>
                  <Icon name="Check" size="sm" />
                  Finish Reconciling
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={currentIsDone ? "outline" : "default"}
                  onClick={toggleDone}
                >
                  <Icon
                    name={currentIsDone ? "CheckCheck" : "Check"}
                    size="sm"
                  />
                  {currentIsDone ? "Done — Undo" : "Mark Done"}
                </Button>
              )}

              {count > 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="min"
                      className="h-8 w-8"
                      disabled={currentIndex === count - 1}
                      onClick={() => goTo(currentIndex + 1)}
                    >
                      <Icon name="ChevronRight" size="sm" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next task</TooltipContent>
                </Tooltip>
              )}
            </InlineStack>
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
                Reconciling <strong>{session.targetName}</strong>
                {count > 1 && (
                  <>
                    {" "}
                    · {doneCount}/{count} done
                    {!allDone && ` · task ${currentIndex + 1} of ${count}`}
                  </>
                )}
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
