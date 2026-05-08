import { useRouterState } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";

import { SubgraphBreadcrumbsView } from "@/components/shared/SubgraphBreadcrumbsView";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

const RUNS_V2_PATH_PREFIX = "/runs-v2";

export const SubgraphBreadcrumbs = observer(function SubgraphBreadcrumbs() {
  const { navigation } = useSharedStores();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isRunView = pathname.startsWith(RUNS_V2_PATH_PREFIX);

  const path = navigation.navigationPath.map((entry, i) =>
    i === 0 ? "Root" : entry.displayName,
  );

  const handleNavigate = (index: number) => {
    navigation.navigateToLevel(index);
  };

  const getCrumbTracking = isRunView
    ? (index: number) =>
        tracking("v2.run_view.breadcrumb.navigate", { crumb_index: index })
    : undefined;

  return (
    <SubgraphBreadcrumbsView
      path={path}
      onNavigate={handleNavigate}
      getCrumbTracking={getCrumbTracking}
    />
  );
});
