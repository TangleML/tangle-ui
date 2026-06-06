import { useNavigate, useParams, useSearch } from "@tanstack/react-router";

import { APP_ROUTES } from "@/routes/router";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { ReconcileOverview } from "./ReconcileOverview";
import { getReconcileSession } from "./reconcileSession";

/**
 * Renders the cross-pipeline reconcile overview when the URL carries
 * `?reconcileOverview=<sessionId>` and the session still exists. Being URL-driven
 * means the overview opens on launch and reopens automatically when a target
 * pipeline routes back here after committing ("reconcile next").
 */
export function ReconcileOverviewHost() {
  const search = useSearch({ strict: false });
  const params = useParams({ strict: false });
  const navigate = useNavigate();
  const { editor } = useSharedStores();

  const overviewId =
    "reconcileOverview" in search &&
    typeof search.reconcileOverview === "string"
      ? search.reconcileOverview
      : undefined;

  const session = overviewId ? getReconcileSession(overviewId) : undefined;
  if (!overviewId || !session) return null;

  const finish = () => {
    const pipelineName =
      "pipelineName" in params && typeof params.pipelineName === "string"
        ? params.pipelineName
        : undefined;
    if (pipelineName) {
      void navigate({
        to: APP_ROUTES.EDITOR_V2_PIPELINE,
        params: { pipelineName },
        search: {},
      });
    }
    // Spotlight the task that was originally edited so the user lands with context.
    if (session.originTaskId) {
      editor.setPendingFocusNode(session.originTaskId);
      editor.setSpotlightNode(session.originTaskId);
    }
  };

  return <ReconcileOverview session={session} onFinish={finish} />;
}
