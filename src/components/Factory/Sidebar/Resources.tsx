import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";

import { RESOURCES } from "../data/resources";

interface ResourcesProps {
  coins: number;
  knowledge: number;
}

const Resources = ({ coins, knowledge }: ResourcesProps) => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        {RESOURCES.coins.icon} {coins}
      </SidebarGroupLabel>
      <SidebarGroupLabel>
        {RESOURCES.knowledge.icon} {knowledge}
      </SidebarGroupLabel>
    </SidebarGroup>
  );
};

export default Resources;
