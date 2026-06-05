import { useBlocker } from "@tanstack/react-router";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { reconcileModeStore } from "./reconcileModeStore";

/**
 * Guards against accidentally leaving reconcile mode. While reconciling, any
 * navigation that doesn't stay within the active session (the return-to overview
 * or another reconcile target) is intercepted with a Tangle-styled prompt;
 * `enableBeforeUnload` additionally covers refresh / tab close (browser-native).
 */
export function ReconcileNavigationGuard() {
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => {
      const session = reconcileModeStore.session;
      if (!session) return false;
      const search = (next.search ?? {}) as Record<string, unknown>;
      const staysInFlow =
        search.reconcile === session.sessionId ||
        search.reconcileOverview === session.sessionId;
      return !staysInFlow;
    },
    enableBeforeUnload: () => reconcileModeStore.active,
    withResolver: true,
  });

  if (blocker.status !== "blocked") return null;

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave reconcile?</AlertDialogTitle>
          <AlertDialogDescription>
            You’re about to leave to {blocker.next.pathname}. Staged, unsaved
            changes in this pipeline will be discarded.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset()}>
            Return to reconcile
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              reconcileModeStore.exit();
              blocker.proceed();
            }}
          >
            Continue anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
