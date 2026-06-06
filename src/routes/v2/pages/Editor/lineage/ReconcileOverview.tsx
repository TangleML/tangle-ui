import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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

import type { ReconcileSession } from "./reconcileSession";
import { updateReconcileSession } from "./reconcileSession";
import {
  type ReconcileTarget,
  scanPipelinesForLineage,
} from "./scanPipelinesForLineage";

interface ReconcileOverviewProps {
  session: ReconcileSession;
  onFinish: () => void;
}

/**
 * Format an author string for compact display.
 *   morgan.wowk@shopify.com → Morgan
 *   mwowk@shopify.com       → Mwowk
 *   Tangle Dev Team         → Tangle Dev Team (unchanged)
 */
function formatAuthor(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.includes("@")) {
    const left = raw.split("@")[0];
    const name = left.includes(".") ? left.split(".")[0] : left;
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
  return raw;
}

/**
 * Human-readable label for a reconcile target row.
 * Root level shows just the pipeline name; subgraph levels append the path.
 */
function targetLabel(target: ReconcileTarget): string {
  if (target.subgraphPath.length === 0) return target.pipelineName;
  return `${target.pipelineName} › ${target.subgraphPath.join(" › ")}`;
}

export function ReconcileOverview({
  session,
  onFinish,
}: ReconcileOverviewProps) {
  const navigate = useNavigate();
  const { autoSave } = useEditorSession();

  const [targets, setTargets] = useState<ReconcileTarget[] | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const results = await scanPipelinesForLineage(
        session.originId,
        session.targetDigest,
      );
      if (!cancelled) {
        // Exclude the root-level of the origin pipeline — the user just did
        // "Update this task" there, so it already appears reconciled and adds
        // noise. Subgraph-level targets from the origin pipeline are kept.
        setTargets(
          results.filter(
            (t) =>
              !(
                t.storageKey === session.returnToPipeline &&
                t.subgraphPath.length === 0
              ),
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.originId, session.targetDigest]);

  const handleReconcile = async (target: ReconcileTarget) => {
    // Store the target subgraph path so ReconcileModeController can navigate
    // into the right depth automatically after the pipeline loads.
    updateReconcileSession(session.sessionId, {
      targetSubgraphPath: target.subgraphPath,
    });
    await autoSave.save();
    await navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: target.storageKey },
      search: { reconcile: session.sessionId },
    });
  };

  const copyLink = (storageKey: string) => {
    const url = `${window.location.origin}/editor-v2/${encodeURIComponent(storageKey)}`;
    void navigator.clipboard.writeText(url);
    setCopiedKey(storageKey);
    setTimeout(() => setCopiedKey(null), 1200);
  };

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onFinish();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Reconcile &ldquo;{session.targetName}&rdquo; across pipelines
          </DialogTitle>
          <DialogDescription>
            Update other pipelines (and subgraphs) that use this
            component&apos;s origin to your edited version. Each opens directly
            at the right context.
          </DialogDescription>
        </DialogHeader>

        <BlockStack gap="0" className="max-h-[60vh] overflow-y-auto">
          {targets === null && (
            <Text size="sm" tone="subdued" className="py-2">
              Scanning pipelines…
            </Text>
          )}

          {targets !== null && targets.length === 0 && (
            <Text size="sm" tone="subdued" className="py-2">
              No pipelines use this component.
            </Text>
          )}

          {targets?.map((target) => {
            const done = target.pendingCount === 0;
            const author = formatAuthor(target.author);
            const label = targetLabel(target);
            const isCurrent =
              target.storageKey === session.returnToPipeline &&
              target.subgraphPath.length === 0;

            return (
              <div
                key={`${target.storageKey}::${target.subgraphPath.join("/")}`}
                className="group flex h-6 items-center gap-2 rounded-sm px-1 hover:bg-muted/50"
              >
                {/* Status dot */}
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    done ? "bg-emerald-500" : "bg-amber-400"
                  }`}
                />

                {/* Label (pipeline › subgraph path) + current + author */}
                <span className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden">
                  <Text
                    size="xs"
                    className="truncate"
                    tone={done ? "subdued" : undefined}
                  >
                    {label}
                  </Text>
                  {isCurrent && (
                    <Text size="xs" tone="subdued" className="shrink-0 italic">
                      current
                    </Text>
                  )}
                  {author && (
                    <Text size="xs" tone="subdued" className="shrink-0">
                      {author}
                    </Text>
                  )}
                </span>

                {/* Right-side actions */}
                <InlineStack gap="1" blockAlign="center" className="shrink-0">
                  {done ? (
                    <>
                      <Icon
                        name="Check"
                        size="xs"
                        className="text-emerald-600"
                      />
                      <button
                        type="button"
                        title="Copy link to pipeline"
                        className={`flex cursor-pointer items-center rounded p-0.5 opacity-0 transition-all group-hover:opacity-100 ${
                          copiedKey === target.storageKey
                            ? "text-emerald-600"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        onClick={() => copyLink(target.storageKey)}
                      >
                        <Icon name="Link" size="xs" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="flex cursor-pointer items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      onClick={() => void handleReconcile(target)}
                    >
                      Reconcile
                      <Icon name="ArrowRight" size="xs" />
                    </button>
                  )}
                </InlineStack>
              </div>
            );
          })}
        </BlockStack>

        <DialogFooter>
          <Button variant="outline" onClick={onFinish}>
            Finish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
