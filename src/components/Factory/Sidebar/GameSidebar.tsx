import { Sidebar, SidebarContent } from "@/components/ui/sidebar";

import Buildings from "./Buildings";
import Controls from "./Controls";
import Resources from "./Resources";

const GameSidebar = () => {
  return (
    <Sidebar
      side="left"
      className="mt-14 h-[calc(100vh-56px)]"
      collapsible="icon"
    >
      <SidebarContent className="gap-0! m-0! p-0!">
        <Controls />
        <Resources />
        <Buildings />
      </SidebarContent>
    </Sidebar>
  );
};

export default GameSidebar;
