import { observer } from "mobx-react-lite";

import { SubgraphBreadcrumbsView } from "@/components/shared/SubgraphBreadcrumbsView";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

export const SubgraphBreadcrumbs = observer(function SubgraphBreadcrumbs() {
  const { navigation } = useSharedStores();
  const isRunView = !!useExecutionDataOptional();

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
