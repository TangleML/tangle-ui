import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import type { HydratedComponentReference } from "@/utils/componentSpec";

import {
  createReconcileSession,
  type ReconcileSession,
  updateReconcileSession,
} from "./reconcileSession";
import {
  type PipelineLineageMatch,
  scanPipelinesForLineage,
} from "./scanPipelinesForLineage";

interface ReconcileOverviewProps {
  /** The edited (target) component every instance is reconciled to. */
  component: HydratedComponentReference;
  originId: string;
  onClose: () => void;
}

/**
 * Cross-pipeline reconcile overview: lists every locally-stored pipeline that
 * uses the edited component's origin and lets the user reconcile each in turn.
 * Clicking "Reconcile" flushes the current pipeline, then routes to the target
 * pipeline in reconcile mode (`?reconcile=<sessionId>`), where the change is
 * staged and committed via the node-anchored "Finish Reconciling" button.
 */
export function ReconcileOverview({
  component,
  originId,
  onClose,
}: ReconcileOverviewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { autoSave } = useEditorSession();

  const sessionRef = useRef<ReconcileSession | null>(null);
  const [pipelines, setPipelines] = useState<PipelineLineageMatch[] | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const results = await scanPipelinesForLineage(originId, component.digest);
      if (cancelled) return;

      const session = createReconcileSession({
        originId,
        targetDigest: component.digest,
        targetComponentText: component.text,
        targetName: component.name,
        returnTo: "",
        worklist: results.map((r) => ({
          storageKey: r.storageKey,
          status: "pending" as const,
        })),
      });
      const returnTo = `${location.pathname}?reconcileOverview=${session.sessionId}`;
      updateReconcileSession(session.sessionId, { returnTo });
      sessionRef.current = { ...session, returnTo };

      setPipelines(results);
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally runs once when the overview opens; props are fixed for its
    // lifetime (it is mounted only while active).
  }, []);

  const handleReconcile = async (storageKey: string) => {
    const session = sessionRef.current;
    if (!session) return;
    // Persist the current pipeline before navigating away.
    await autoSave.save();
    await navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: storageKey },
      search: { reconcile: session.sessionId },
    });
  };

  const totalPending = pipelines?.reduce((n, p) => n + p.pendingCount, 0) ?? 0;

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Reconcile “{component.name}” across pipelines
          </DialogTitle>
          <DialogDescription>
            Update other pipelines that use this component’s origin to your
            edited version. Each opens in the editor so you can review and apply
            the change in context.
          </DialogDescription>
        </DialogHeader>

        <BlockStack gap="2" className="max-h-[55vh] overflow-y-auto py-1">
          {pipelines === null && (
            <Text size="sm" tone="subdued">
              Scanning pipelines…
            </Text>
          )}

          {pipelines !== null && pipelines.length === 0 && (
            <Text size="sm" tone="subdued">
              No other pipelines use this component.
            </Text>
          )}

          {pipelines?.map((pipeline) => {
            const done = pipeline.pendingCount === 0;
            return (
              <InlineStack
                key={pipeline.storageKey}
                align="space-between"
                blockAlign="center"
                gap="2"
                className="rounded-md border px-3 py-2"
              >
                <BlockStack gap="0" className="min-w-0">
                  <Text size="sm" weight="semibold" className="truncate">
                    {pipeline.pipelineName}
                  </Text>
                  <Text size="xs" tone="subdued">
                    {done
                      ? `${pipeline.reconciledCount} reconciled`
                      : `${pipeline.pendingCount} of ${pipeline.tasks.length} to update`}
                  </Text>
                </BlockStack>

                {done ? (
                  <InlineStack gap="1" blockAlign="center">
                    <Icon name="Check" size="sm" className="text-emerald-600" />
                    <Text size="xs" tone="subdued">
                      Reconciled
                    </Text>
                  </InlineStack>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => void handleReconcile(pipeline.storageKey)}
                  >
                    Reconcile
                  </Button>
                )}
              </InlineStack>
            );
          })}
        </BlockStack>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {totalPending === 0 ? "Done" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
