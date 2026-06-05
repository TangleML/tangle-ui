import { useNavigate, useParams, useSearch } from "@tanstack/react-router";

import { APP_ROUTES } from "@/routes/router";

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

  const overviewId =
    "reconcileOverview" in search &&
    typeof search.reconcileOverview === "string"
      ? search.reconcileOverview
      : undefined;

  const session = overviewId ? getReconcileSession(overviewId) : undefined;
  if (!overviewId || !session) return null;

  const close = () => {
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
  };

  return <ReconcileOverview session={session} onClose={close} />;
}
