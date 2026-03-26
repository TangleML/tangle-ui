import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";

import { RESOURCES } from "../data/resources";

const Resources = () => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{RESOURCES.coins.icon} 0</SidebarGroupLabel>
      <SidebarGroupLabel>{RESOURCES.knowledge.icon} 0</SidebarGroupLabel>
    </SidebarGroup>
  );
};

export default Resources;
