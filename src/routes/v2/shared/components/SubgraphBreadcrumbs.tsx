import { observer } from "mobx-react-lite";

import { SubgraphBreadcrumbsView } from "@/components/shared/SubgraphBreadcrumbsView";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export const SubgraphBreadcrumbs = observer(function SubgraphBreadcrumbs() {
  const { navigation } = useSharedStores();

  const path = navigation.navigationPath.map((entry, i) =>
    i === 0 ? "Root" : entry.displayName,
  );

  const handleNavigate = (index: number) => {
    navigation.navigateToLevel(index);
  };

  return <SubgraphBreadcrumbsView path={path} onNavigate={handleNavigate} />;
});
