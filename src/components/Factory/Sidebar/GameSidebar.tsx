import { Sidebar, SidebarContent } from "@/components/ui/sidebar";

import Buildings from "./Buildings";
import GlobalResources from "./GlobalResources";
import { Time } from "./Time";

const GameSidebar = () => {
  return (
    <Sidebar
      side="left"
      className="mt-14 h-[calc(100vh-56px)] z-100"
      collapsible="icon"
    >
      <SidebarContent>
        <Time />
        <GlobalResources />
        <Buildings />
      </SidebarContent>
    </Sidebar>
  );
};

export default GameSidebar;
