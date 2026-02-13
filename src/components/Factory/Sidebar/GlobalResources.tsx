import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";

import { RESOURCES } from "../data/resources";
import { useGlobalResources } from "../providers/GlobalResourcesProvider";
import { isResourceType } from "../types/resources";

const GlobalResources = () => {
  const { resources } = useGlobalResources();
  return (
    <SidebarGroup>
      {Object.entries(resources).map(
        ([key, amount]) =>
          isResourceType(key) && (
            <SidebarGroupLabel key={key}>
              {RESOURCES[key].icon || key} {amount}
            </SidebarGroupLabel>
          ),
      )}
    </SidebarGroup>
  );
};

export default GlobalResources;
